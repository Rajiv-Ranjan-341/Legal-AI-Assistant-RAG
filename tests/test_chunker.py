import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from langchain_core.documents import Document
from src.ingestion.chunker import extract_section_metadata, chunk_legal_documents


def test_extract_section_metadata_finds_section():
    text = "Section 302. Punishment for murder.\nWhoever commits murder shall be punished."
    meta = extract_section_metadata(text)
    assert "legal_section" in meta
    assert "Section 302" in meta["legal_section"]


def test_extract_section_metadata_finds_article():
    text = "Article 21. Protection of life and personal liberty."
    meta = extract_section_metadata(text)
    assert "Article 21" in meta["legal_section"]


def test_extract_section_metadata_no_match():
    text = "This is plain text without any section references."
    meta = extract_section_metadata(text)
    assert "legal_section" not in meta


def test_chunk_legal_documents_adds_metadata():
    long_text = "Section 302. Punishment for murder.\n" + ("Some legal text. " * 200)
    docs = [Document(page_content=long_text, metadata={"source_file": "ipc.pdf"})]
    chunks = chunk_legal_documents(docs, chunk_size=500, chunk_overlap=100)
    assert len(chunks) > 1
    assert all("chunk_length" in c.metadata for c in chunks)
    assert chunks[0].metadata.get("legal_section") == "Section 302"
