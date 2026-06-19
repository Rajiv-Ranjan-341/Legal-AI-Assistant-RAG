import os
import sys
import json
import time
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from src.agents.graph import create_agent_graph
from src.agents.rag_chain import query_rag
from config.settings import settings
from loguru import logger

agent_graph = None
QUERY_LOG_PATH = Path("./chroma_db/query_log.json")
query_log: list[dict] = []
_log_lock = asyncio.Lock()

FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"


def _load_query_log():
    global query_log
    if QUERY_LOG_PATH.exists():
        try:
            query_log = json.loads(QUERY_LOG_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            query_log = []


def _save_query_log():
    try:
        QUERY_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        QUERY_LOG_PATH.write_text(json.dumps(query_log, indent=2))
    except OSError as e:
        logger.warning(f"Failed to persist query log: {e}")


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _stream_direct_rag(question: str):
    from src.retrieval.hybrid_search import hybrid_search
    from src.retrieval.reranker import rerank
    from src.agents.rag_chain import format_context, RAG_PROMPT
    from src.agents.prompts import SYSTEM_PROMPT
    from src.llm import get_llm

    start = time.time()
    yield _sse("status", {"message": "Searching legal database..."})

    results = await asyncio.to_thread(hybrid_search, question, 20)

    yield _sse("status", {"message": "Reranking results..."})
    reranked = await asyncio.to_thread(rerank, question, results, 5)

    yield _sse("status", {"message": "Generating answer..."})

    context = format_context(reranked)
    llm = get_llm()
    msgs = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=RAG_PROMPT.format(context=context, question=question)),
    ]

    async for chunk in llm.astream(msgs):
        token = getattr(chunk, "content", "") or ""
        if token:
            yield _sse("token", {"token": token})

    sources = [
        {
            "source_file": doc.metadata.get("source_file", "Unknown"),
            "legal_section": doc.metadata.get("legal_section", ""),
            "page": doc.metadata.get("page", ""),
            "rerank_score": doc.metadata.get("rerank_score", 0),
            "excerpt": doc.page_content[:300],
        }
        for doc in reranked
    ]
    yield _sse("sources", {"sources": sources})

    elapsed = round(time.time() - start, 1)
    async with _log_lock:
        query_log.append({"question": question, "mode": "direct", "time": elapsed, "verified": True})
        _save_query_log()

    yield _sse("done", {"verified": True, "mode_used": "direct_rag"})


async def _stream_agentic(question: str):
    start = time.time()
    yield _sse("status", {"message": "Starting agentic analysis..."})

    input_state = {
        "messages": [HumanMessage(content=question)],
        "verified": False,
        "verification_attempts": 0,
        "used_fallback": False,
    }

    try:
        current_answer = ""
        async for event in agent_graph.astream_events(input_state, version="v2"):
            kind = event["event"]
            node = event.get("metadata", {}).get("langgraph_node", "")

            if kind == "on_chat_model_start" and node == "agent":
                if current_answer:
                    current_answer = ""
                    yield _sse("clear", {})
                    yield _sse("status", {"message": "Refining answer..."})

            elif kind == "on_chat_model_stream" and node == "agent":
                chunk = event["data"]["chunk"]
                token = getattr(chunk, "content", "") or ""
                if token:
                    current_answer += token
                    yield _sse("token", {"token": token})

            elif kind == "on_tool_start":
                tool_name = event.get("name", "tool")
                yield _sse("status", {"message": f"Using {tool_name}..."})

            elif kind == "on_tool_end":
                yield _sse("status", {"message": "Analyzing results..."})

        elapsed = round(time.time() - start, 1)
        async with _log_lock:
            query_log.append({"question": question, "mode": "agentic", "time": elapsed, "verified": True})
            _save_query_log()

        yield _sse("done", {"verified": True, "mode_used": "agentic"})

    except Exception as e:
        logger.warning(f"Agentic stream failed: {e}, falling back to direct RAG")
        yield _sse("clear", {})
        yield _sse("status", {"message": "Falling back to direct search..."})
        async for evt in _stream_direct_rag(question):
            yield evt


@asynccontextmanager
async def lifespan(app: FastAPI):
    global agent_graph
    _load_query_log()
    agent_graph = create_agent_graph()
    yield


app = FastAPI(
    title="Indian Legal AI Assistant",
    description="Agentic RAG system for Indian law",
    version="1.0.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()


# ──────────────────── Query Endpoint ────────────────────

class QueryRequest(BaseModel):
    question: str
    mode: str = "direct"
    session_id: str = "default"


class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]
    verified: bool
    mode_used: str


@router.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    start = time.time()

    if request.mode == "direct":
        result = query_rag(request.question)
        elapsed = round(time.time() - start, 1)
        async with _log_lock:
            query_log.append({
                "question": request.question,
                "mode": "direct",
                "time": elapsed,
                "verified": True,
            })
            _save_query_log()
        return QueryResponse(
            answer=result["answer"],
            sources=result["sources"],
            verified=True,
            mode_used="direct_rag",
        )

    try:
        result = await agent_graph.ainvoke(
            {
                "messages": [HumanMessage(content=request.question)],
                "verified": False,
                "verification_attempts": 0,
                "used_fallback": False,
            }
        )

        answer = ""
        for msg in reversed(result["messages"]):
            if isinstance(msg, AIMessage) and not msg.tool_calls:
                content = str(msg.content)
                if len(content) > 30:
                    answer = content
                    break

        elapsed = round(time.time() - start, 1)
        verified = result.get("verified", False)
        mode_used = "agentic" if not result.get("used_fallback") else "fallback_rag"

        async with _log_lock:
            query_log.append({
                "question": request.question,
                "mode": mode_used,
                "time": elapsed,
                "verified": verified,
            })
            _save_query_log()

        return QueryResponse(
            answer=answer or "No answer generated.",
            sources=[],
            verified=verified,
            mode_used=mode_used,
        )
    except Exception as e:
        logger.warning(f"Agentic query failed: {e}, falling back to direct RAG")
        result = query_rag(request.question)
        elapsed = round(time.time() - start, 1)
        async with _log_lock:
            query_log.append({
                "question": request.question,
                "mode": "fallback_rag",
                "time": elapsed,
                "verified": True,
            })
            _save_query_log()
        return QueryResponse(
            answer=result["answer"],
            sources=result["sources"],
            verified=True,
            mode_used="fallback_rag",
        )


# ──────────────────── Streaming Query Endpoint ────────────────────

@router.post("/query/stream")
async def query_stream(request: QueryRequest):
    generator = _stream_direct_rag(request.question) if request.mode == "direct" else _stream_agentic(request.question)
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ──────────────────── Documents Endpoints ────────────────────

@router.get("/documents")
async def list_documents():
    import pickle
    from src.retrieval.bm25_store import BM25_CACHE_PATH

    if not BM25_CACHE_PATH.exists():
        return {"documents": []}

    with open(BM25_CACHE_PATH, "rb") as f:
        data = pickle.load(f)

    documents = data["documents"]
    doc_stats = defaultdict(lambda: {"pages": set(), "chunks": 0, "total_length": 0, "sections": defaultdict(int)})

    for doc in documents:
        filename = doc.metadata.get("source_file", "unknown")
        page = doc.metadata.get("page", 0)
        section = doc.metadata.get("legal_section", "")
        doc_stats[filename]["pages"].add(page)
        doc_stats[filename]["chunks"] += 1
        doc_stats[filename]["total_length"] += len(doc.page_content)
        if section:
            label = section.split()[0] if section else "Other"
            doc_stats[filename]["sections"][label] += 1

    result = []
    for filename, stats in sorted(doc_stats.items()):
        result.append({
            "filename": filename,
            "pages": len(stats["pages"]),
            "chunk_count": stats["chunks"],
            "avg_chunk_size": round(stats["total_length"] / max(stats["chunks"], 1)),
            "section_distribution": dict(stats["sections"]),
        })

    return {"documents": result}


@router.get("/documents/{filename}/chunks")
async def get_document_chunks(filename: str, page: int = 1, search: str = ""):
    import pickle
    from src.retrieval.bm25_store import BM25_CACHE_PATH

    if not BM25_CACHE_PATH.exists():
        return {"chunks": [], "total": 0, "page": 1, "pages": 1}

    with open(BM25_CACHE_PATH, "rb") as f:
        data = pickle.load(f)

    all_docs = data["documents"]
    filtered = [d for d in all_docs if d.metadata.get("source_file", "") == filename]

    if search:
        search_lower = search.lower()
        filtered = [d for d in filtered if search_lower in d.page_content.lower()]

    per_page = 10
    total = len(filtered)
    pages = max(1, (total + per_page - 1) // per_page)
    page = max(1, min(page, pages))
    start = (page - 1) * per_page
    page_docs = filtered[start:start + per_page]

    chunks = []
    for doc in page_docs:
        chunks.append({
            "content": doc.page_content,
            "legal_section": doc.metadata.get("legal_section", ""),
            "page": doc.metadata.get("page"),
            "length": len(doc.page_content),
        })

    return {"chunks": chunks, "total": total, "page": page, "pages": pages}


# ──────────────────── Graph Endpoint ────────────────────

@router.get("/graph/stats")
async def graph_stats():
    from src.retrieval.knowledge_graph import get_graph_stats
    stats = get_graph_stats()
    if not stats:
        return {"error": "Knowledge graph not built. Run ingestion first."}
    return stats


# ──────────────────── Analytics Endpoint ────────────────────

@router.get("/analytics")
async def analytics():
    import pickle
    from src.retrieval.bm25_store import BM25_CACHE_PATH
    from src.retrieval.knowledge_graph import get_graph_stats

    doc_data = []
    total_chunks = 0
    total_documents = 0

    if BM25_CACHE_PATH.exists():
        with open(BM25_CACHE_PATH, "rb") as f:
            data = pickle.load(f)

        documents = data["documents"]
        total_chunks = len(documents)

        chunks_by_file = defaultdict(int)
        for doc in documents:
            filename = doc.metadata.get("source_file", "unknown")
            chunks_by_file[filename] += 1

        total_documents = len(chunks_by_file)
        for filename, count in sorted(chunks_by_file.items(), key=lambda x: -x[1]):
            short_name = filename.replace(".pdf", "").replace("_", " ")[:25]
            doc_data.append({"name": short_name, "chunks": count})

    avg_time = 0
    if query_log:
        avg_time = round(sum(q["time"] for q in query_log) / len(query_log), 1)

    graph = get_graph_stats()

    return {
        "total_documents": total_documents,
        "total_chunks": total_chunks,
        "avg_response_time": avg_time,
        "queries_today": len(query_log),
        "chunks_per_document": doc_data,
        "recent_queries": list(reversed(query_log[-20:])),
        "knowledge_graph": graph,
    }


# ──────────────────── Evaluation Endpoint ────────────────────

@router.post("/evaluate")
async def evaluate():
    from src.evaluation.metrics import evaluate_rag_pipeline
    if agent_graph is None:
        return {"error": "Agent graph not initialized"}
    result = await evaluate_rag_pipeline(agent_graph)
    return {"scores": {k: round(v, 4) for k, v in result.items() if isinstance(v, (int, float))}}


# ──────────────────── Health ────────────────────

@router.get("/health")
async def health():
    return {"status": "ok"}


# ──────────────────── Mount API + Static Files ────────────────────

app.include_router(router, prefix="/api")

if FRONTEND_DIR.is_dir():
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", settings.api_port))
    uvicorn.run(app, host="0.0.0.0", port=port)
