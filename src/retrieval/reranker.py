from sentence_transformers import CrossEncoder
from langchain_core.documents import Document
from config.settings import settings
from loguru import logger

_reranker = None


def get_reranker() -> CrossEncoder:
    global _reranker
    if _reranker is None:
        logger.info(f"Loading reranker: {settings.reranker_model}")
        _reranker = CrossEncoder(settings.reranker_model)
    return _reranker


def rerank(query: str, documents: list[Document], top_k: int | None = None) -> list[Document]:
    top_k = top_k or settings.top_k_rerank

    if not documents:
        return []

    reranker = get_reranker()
    pairs = [[query, doc.page_content] for doc in documents]
    scores = reranker.predict(pairs)

    for doc, score in zip(documents, scores):
        doc.metadata["rerank_score"] = float(score)

    reranked = sorted(documents, key=lambda d: d.metadata["rerank_score"], reverse=True)

    logger.info(f"Reranked {len(documents)} → top {top_k}")
    return reranked[:top_k]
