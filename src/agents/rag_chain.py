from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.documents import Document
from src.retrieval.hybrid_search import hybrid_search
from src.retrieval.reranker import rerank
from src.llm import get_llm
from src.agents.prompts import SYSTEM_PROMPT
from loguru import logger


def format_context(documents: list[Document]) -> str:
    parts = []
    for i, doc in enumerate(documents, 1):
        source = doc.metadata.get("source_file", "Unknown")
        section = doc.metadata.get("legal_section", "")
        page = doc.metadata.get("page", "")

        header = f"[Source {i}] {source}"
        if section:
            header += f" | {section}"
        if page:
            header += f" | Page {page}"

        parts.append(f"{header}\n{doc.page_content}")

    return "\n\n---\n\n".join(parts)


RAG_PROMPT = """Based on the following retrieved legal provisions, answer the user's question.
Cite specific sections/articles with their source. If the context doesn't contain enough information, say so.

CONTEXT:
{context}

QUESTION: {question}

Provide a comprehensive, well-structured answer with citations:"""


def query_rag(question: str, top_k_retrieve: int = 20, top_k_rerank: int = 5) -> dict:
    logger.info(f"RAG query: {question}")

    results = hybrid_search(question, top_k=top_k_retrieve)
    reranked = rerank(question, results, top_k=top_k_rerank)
    context = format_context(reranked)

    llm = get_llm()
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=RAG_PROMPT.format(context=context, question=question)),
    ]

    response = llm.invoke(messages)

    sources = []
    for doc in reranked:
        sources.append({
            "source_file": doc.metadata.get("source_file", "Unknown"),
            "legal_section": doc.metadata.get("legal_section", ""),
            "page": doc.metadata.get("page", ""),
            "rerank_score": doc.metadata.get("rerank_score", 0),
            "excerpt": doc.page_content[:300],
        })

    return {
        "answer": response.content,
        "sources": sources,
        "num_chunks_retrieved": len(results),
        "num_chunks_reranked": len(reranked),
    }
