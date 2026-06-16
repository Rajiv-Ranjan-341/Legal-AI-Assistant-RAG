import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from langchain_core.documents import Document
from src.retrieval.hybrid_search import reciprocal_rank_fusion


def _make_doc(content: str, source: str = "test.pdf", start_index: int = 0) -> Document:
    return Document(
        page_content=content,
        metadata={"source_file": source, "start_index": start_index},
    )


def test_rrf_merges_two_lists():
    list1 = [_make_doc("Doc A", start_index=0), _make_doc("Doc B", start_index=100)]
    list2 = [_make_doc("Doc B", start_index=100), _make_doc("Doc C", start_index=200)]

    fused = reciprocal_rank_fusion([list1, list2])
    assert len(fused) == 3
    assert all("rrf_score" in d.metadata for d in fused)
    contents = [d.page_content for d in fused]
    assert contents[0] == "Doc B"


def test_rrf_single_list():
    docs = [_make_doc("Only doc")]
    fused = reciprocal_rank_fusion([docs])
    assert len(fused) == 1


def test_rrf_empty_lists():
    fused = reciprocal_rank_fusion([[], []])
    assert fused == []


def test_rrf_score_increases_with_multiple_appearances():
    fused_single = reciprocal_rank_fusion([
        [_make_doc("Doc A", start_index=0)],
    ])
    fused_triple = reciprocal_rank_fusion([
        [_make_doc("Doc A", start_index=0)],
        [_make_doc("Doc A", start_index=0)],
        [_make_doc("Doc A", start_index=0)],
    ])

    assert fused_triple[0].metadata["rrf_score"] > fused_single[0].metadata["rrf_score"]
