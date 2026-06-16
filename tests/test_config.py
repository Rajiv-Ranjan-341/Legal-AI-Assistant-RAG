import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings import settings


def test_settings_defaults():
    assert settings.chunk_size == 1000
    assert settings.chunk_overlap == 200
    assert settings.top_k_retrieval == 20
    assert settings.top_k_rerank == 5
    assert settings.api_port == 8000


def test_cors_origins_is_set():
    assert settings.cors_origins
    origins = [o.strip() for o in settings.cors_origins.split(",")]
    assert len(origins) >= 1


def test_embedding_model_is_set():
    assert "bge" in settings.embedding_model.lower() or settings.embedding_model


def test_reranker_model_is_set():
    assert "cross-encoder" in settings.reranker_model
