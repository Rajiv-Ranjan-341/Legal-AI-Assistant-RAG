from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    # LLM Provider
    llm_provider: str = Field(default="gemini", description="gemini | groq | local")

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    # Groq
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # Local (Ollama)
    local_model: str = "llama3.1"
    local_base_url: str = "http://localhost:11434"

    # Embeddings
    embedding_model: str = "BAAI/bge-small-en-v1.5"

    # Vector DB
    vector_db: str = "chroma"
    chroma_persist_dir: str = "./chroma_db"

    # Reranker
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    # Paths
    data_dir: Path = Path("./data/raw")

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # RAG Parameters
    chunk_size: int = 1000
    chunk_overlap: int = 200
    top_k_retrieval: int = 20
    top_k_rerank: int = 5
    bm25_weight: float = 0.4
    dense_weight: float = 0.6

    # Knowledge Graph
    graph_max_hops: int = 1
    graph_expansion_top_k: int = 10


settings = Settings()
