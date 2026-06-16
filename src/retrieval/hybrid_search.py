from langchain_core.documents import Document
from src.retrieval.vector_store import dense_search
from src.retrieval.bm25_store import bm25_search
from src.retrieval.knowledge_graph import graph_expand
from src.retrieval.query_rewriter import rewrite_query
from config.settings import settings
from loguru import logger


def reciprocal_rank_fusion(
    result_lists: list[list[Document]], k: int = 60
) -> list[Document]:
    doc_scores: dict[str, float] = {}
    doc_map: dict[str, Document] = {}

    for results in result_lists:
        for rank, doc in enumerate(results):
            doc_id = f"{doc.metadata.get('source_file', '')}_{doc.metadata.get('start_index', '')}_{hash(doc.page_content[:100])}"
            doc_map[doc_id] = doc
            doc_scores[doc_id] = doc_scores.get(doc_id, 0) + 1 / (k + rank + 1)

    sorted_docs = sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)

    fused = []
    for doc_id, score in sorted_docs:
        doc = doc_map[doc_id]
        doc.metadata["rrf_score"] = score
        fused.append(doc)

    return fused


def _extract_sections(docs: list[Document]) -> list[str]:
    sections = []
    seen = set()
    for doc in docs:
        section = doc.metadata.get("legal_section", "")
        if section and section not in seen:
            seen.add(section)
            sections.append(section)
    return sections


def hybrid_search(
    query: str,
    top_k: int | None = None,
    rewrite: bool = True,
) -> list[Document]:
    top_k = top_k or settings.top_k_retrieval

    search_query = rewrite_query(query) if rewrite else query

    dense_results = dense_search(search_query, top_k=top_k)
    bm25_results = bm25_search(search_query, top_k=top_k)

    seed_sections = _extract_sections(dense_results[:5] + bm25_results[:5])

    graph_results = []
    if seed_sections:
        try:
            graph_results = graph_expand(
                seed_sections,
                top_k=settings.graph_expansion_top_k,
                max_hops=settings.graph_max_hops,
            )
        except FileNotFoundError:
            pass

    fused = reciprocal_rank_fusion([dense_results, bm25_results, graph_results])

    logger.info(
        f"Hybrid search: {len(dense_results)} dense + {len(bm25_results)} BM25 "
        f"+ {len(graph_results)} graph → {len(fused)} fused (returning top {top_k})"
    )
    return fused[:top_k]
