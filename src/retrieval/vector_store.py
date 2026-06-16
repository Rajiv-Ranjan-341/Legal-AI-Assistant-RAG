from langchain_core.documents import Document
from langchain_chroma import Chroma
from src.retrieval.embeddings import get_embedding_model
from config.settings import settings
from loguru import logger

_vector_store: Chroma | None = None


def create_vector_store(documents: list[Document]) -> Chroma:
    global _vector_store

    embedding_model = get_embedding_model()
    logger.info(f"Creating vector store with {len(documents)} documents")

    vector_store = Chroma.from_documents(
        documents=documents,
        embedding=embedding_model,
        persist_directory=settings.chroma_persist_dir,
        collection_name="indian_law",
    )
    _vector_store = vector_store
    logger.info("Vector store created and persisted")
    return vector_store


def load_vector_store() -> Chroma:
    global _vector_store

    if _vector_store is not None:
        return _vector_store

    embedding_model = get_embedding_model()
    _vector_store = Chroma(
        persist_directory=settings.chroma_persist_dir,
        embedding_function=embedding_model,
        collection_name="indian_law",
    )
    count = _vector_store._collection.count()
    logger.info(f"Loaded vector store into memory ({count} documents)")
    return _vector_store


def dense_search(query: str, top_k: int | None = None) -> list[Document]:
    top_k = top_k or settings.top_k_retrieval
    store = load_vector_store()
    results = store.similarity_search_with_relevance_scores(query, k=top_k)
    docs = []
    for doc, score in results:
        doc.metadata["dense_score"] = score
        docs.append(doc)
    return docs
