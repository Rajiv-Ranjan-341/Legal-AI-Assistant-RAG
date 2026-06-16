"""
Ingestion pipeline: Load → Preprocess → Chunk → Index (Vector + BM25)

Usage:
    python -m scripts.ingest
    python -m scripts.ingest --data-dir ./data/raw
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings import settings
from src.ingestion.loader import load_directory
from src.ingestion.preprocessor import preprocess_documents
from src.ingestion.chunker import chunk_legal_documents
from src.ingestion.reference_extractor import extract_all_references
from src.retrieval.vector_store import create_vector_store
from src.retrieval.bm25_store import build_bm25_index
from src.retrieval.knowledge_graph import build_knowledge_graph
from loguru import logger


def main(data_dir: Path | None = None):
    data_dir = data_dir or settings.data_dir

    if not data_dir.exists():
        logger.error(f"Data directory not found: {data_dir}")
        sys.exit(1)

    files = list(data_dir.iterdir())
    if not files:
        logger.error(f"No files found in {data_dir}. Add PDF or TXT legal documents.")
        sys.exit(1)

    logger.info("=== Starting Ingestion Pipeline ===")

    logger.info("Step 1/6: Loading documents...")
    documents = load_directory(data_dir)

    logger.info("Step 2/6: Preprocessing...")
    documents = preprocess_documents(documents)

    logger.info("Step 3/6: Chunking...")
    chunks = chunk_legal_documents(documents)

    logger.info("Step 4/6: Extracting cross-references...")
    references = extract_all_references(chunks)

    logger.info("Step 5/6: Building vector + BM25 indices...")
    create_vector_store(chunks)
    build_bm25_index(chunks)

    logger.info("Step 6/6: Building knowledge graph...")
    graph = build_knowledge_graph(chunks, references)

    ref_sections = set()
    for ref in references:
        ref_sections.add(ref["source"])
        ref_sections.add(ref["target"])

    logger.info(
        f"=== Ingestion Complete: {len(chunks)} chunks, "
        f"{len(references)} cross-references, "
        f"{graph.number_of_nodes()} graph nodes ==="
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest legal documents")
    parser.add_argument("--data-dir", type=Path, default=None)
    args = parser.parse_args()
    main(args.data_dir)
