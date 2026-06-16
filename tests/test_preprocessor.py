import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from langchain_core.documents import Document
from src.ingestion.preprocessor import clean_legal_text, normalize_legal_references, preprocess_documents


def test_clean_legal_text_removes_page_headers():
    text = "Page 42 of 100\nSection 302. Punishment for murder."
    cleaned = clean_legal_text(text)
    assert "Page 42" not in cleaned
    assert "Section 302" in cleaned


def test_clean_legal_text_fixes_hyphenation():
    text = "The provi-\nsion states that"
    cleaned = clean_legal_text(text)
    assert "provision" in cleaned


def test_clean_legal_text_normalizes_whitespace():
    text = "Too   many   spaces\n\n\n\n\nToo many newlines"
    cleaned = clean_legal_text(text)
    assert "   " not in cleaned
    assert "\n\n\n" not in cleaned


def test_normalize_legal_references():
    text = "As per Sec. 302 and Art. 21 of Ch. 3"
    normalized = normalize_legal_references(text)
    assert "Section 302" in normalized
    assert "Article 21" in normalized
    assert "Chapter 3" in normalized


def test_preprocess_documents_drops_empty():
    docs = [
        Document(page_content="Section 302. Punishment for murder is death or life imprisonment.", metadata={}),
        Document(page_content="   ", metadata={}),
        Document(page_content="short", metadata={}),
    ]
    processed = preprocess_documents(docs)
    assert len(processed) == 1
    assert "Section 302" in processed[0].page_content
