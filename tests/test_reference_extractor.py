import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from langchain_core.documents import Document
from src.ingestion.reference_extractor import (
    extract_references_from_chunk,
    extract_all_references,
    _classify_relation,
    _normalize_ref,
)


def test_normalize_ref():
    assert _normalize_ref("section 302") == "Section 302"
    assert _normalize_ref("  Article  21  ") == "Article 21"


def test_classify_relation_qualifies():
    assert _classify_relation("subject to Section 42") == "qualifies"
    assert _classify_relation("notwithstanding anything in Section 10") == "qualifies"


def test_classify_relation_penalty():
    assert _classify_relation("punishable under Section 302") == "penalty"


def test_classify_relation_procedure():
    assert _classify_relation("read with Section 46") == "procedure"


def test_classify_relation_defines():
    assert _classify_relation("as defined in Section 300") == "defines"


def test_classify_relation_default():
    assert _classify_relation("see Section 50") == "references"


def test_extract_references_from_chunk():
    chunk = Document(
        page_content="Section 41 allows arrest without warrant, subject to Section 42 and read with Section 46.",
        metadata={"legal_section": "Section 41", "source_file": "crpc.pdf"},
    )
    refs = extract_references_from_chunk(chunk)
    targets = {r["target"] for r in refs}
    assert "Section 42" in targets
    assert "Section 46" in targets
    assert all(r["source"] == "Section 41" for r in refs)


def test_extract_references_skips_self():
    chunk = Document(
        page_content="Section 302 as mentioned in Section 302 itself.",
        metadata={"legal_section": "Section 302", "source_file": "ipc.pdf"},
    )
    refs = extract_references_from_chunk(chunk)
    assert all(r["target"] != "Section 302" for r in refs)


def test_extract_references_no_section_metadata():
    chunk = Document(
        page_content="This references Section 42.",
        metadata={"source_file": "test.pdf"},
    )
    refs = extract_references_from_chunk(chunk)
    assert len(refs) == 0


def test_extract_all_references_deduplicates():
    chunks = [
        Document(
            page_content="Subject to Section 42 of the Code. Also see Section 42.",
            metadata={"legal_section": "Section 41", "source_file": "crpc.pdf"},
        ),
        Document(
            page_content="As per Section 42, the procedure is clear.",
            metadata={"legal_section": "Section 41", "source_file": "crpc.pdf"},
        ),
    ]
    refs = extract_all_references(chunks)
    sec42_refs = [r for r in refs if r["target"] == "Section 42" and r["source"] == "Section 41"]
    assert len(sec42_refs) == 1
