import pickle
from pathlib import Path
from rank_bm25 import BM25Okapi
from langchain_core.documents import Document
from loguru import logger

BM25_CACHE_PATH = Path("./chroma_db/bm25_index.pkl")

_bm25_cache: dict | None = None


def _tokenize(text: str) -> list[str]:
    return text.lower().split()


def build_bm25_index(documents: list[Document]) -> None:
    global _bm25_cache

    corpus = [_tokenize(doc.page_content) for doc in documents]
    bm25 = BM25Okapi(corpus)

    BM25_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(BM25_CACHE_PATH, "wb") as f:
        pickle.dump({"bm25": bm25, "documents": documents}, f)

    _bm25_cache = {"bm25": bm25, "documents": documents}
    logger.info(f"BM25 index built with {len(documents)} documents")


def _load_bm25() -> dict:
    global _bm25_cache

    if _bm25_cache is not None:
        return _bm25_cache

    if not BM25_CACHE_PATH.exists():
        raise FileNotFoundError("BM25 index not found. Run ingestion first.")

    with open(BM25_CACHE_PATH, "rb") as f:
        _bm25_cache = pickle.load(f)

    logger.info(f"BM25 index loaded into memory ({len(_bm25_cache['documents'])} documents)")
    return _bm25_cache


def bm25_search(query: str, top_k: int = 20) -> list[Document]:
    data = _load_bm25()
    bm25: BM25Okapi = data["bm25"]
    documents: list[Document] = data["documents"]

    tokenized_query = _tokenize(query)
    scores = bm25.get_scores(tokenized_query)

    scored_docs = sorted(
        zip(documents, scores), key=lambda x: x[1], reverse=True
    )[:top_k]

    results = []
    for doc, score in scored_docs:
        doc_copy = Document(
            page_content=doc.page_content,
            metadata={**doc.metadata, "bm25_score": float(score)},
        )
        results.append(doc_copy)

    return results
