from pathlib import Path
from langchain_core.documents import Document
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from loguru import logger


def load_document(file_path: Path) -> list[Document]:
    suffix = file_path.suffix.lower()

    if suffix == ".pdf":
        loader = PyPDFLoader(str(file_path))
    elif suffix == ".txt":
        loader = TextLoader(str(file_path), encoding="utf-8")
    else:
        raise ValueError(f"Unsupported file type: {suffix}")

    docs = loader.load()
    for doc in docs:
        doc.metadata["source_file"] = file_path.name
        doc.metadata["file_type"] = suffix

    logger.info(f"Loaded {len(docs)} pages from {file_path.name}")
    return docs


def load_directory(dir_path: Path) -> list[Document]:
    all_docs = []
    supported = {".pdf", ".txt"}

    for file_path in sorted(dir_path.iterdir()):
        if file_path.suffix.lower() in supported:
            try:
                docs = load_document(file_path)
                all_docs.extend(docs)
            except Exception as e:
                logger.error(f"Failed to load {file_path.name}: {e}")

    logger.info(f"Total documents loaded: {len(all_docs)} from {dir_path}")
    return all_docs
