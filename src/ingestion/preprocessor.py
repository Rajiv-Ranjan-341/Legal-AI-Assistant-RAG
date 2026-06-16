import re
from langchain_core.documents import Document
from loguru import logger


def clean_legal_text(text: str) -> str:
    text = text.replace("\r\n", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"^\s+$", "", text, flags=re.MULTILINE)
    text = re.sub(r"-\n(\w)", r"\1", text)
    text = re.sub(r"Page\s*\d+\s*(of\s*\d+)?", "", text, flags=re.IGNORECASE)
    return text.strip()


def normalize_legal_references(text: str) -> str:
    text = re.sub(r"(?i)\bsec\.?\s*(\d+)", r"Section \1", text)
    text = re.sub(r"(?i)\bart\.?\s*(\d+)", r"Article \1", text)
    text = re.sub(r"(?i)\bch\.?\s*(\d+)", r"Chapter \1", text)
    return text


def preprocess_documents(documents: list[Document]) -> list[Document]:
    processed = []
    for doc in documents:
        cleaned = clean_legal_text(doc.page_content)
        cleaned = normalize_legal_references(cleaned)

        if len(cleaned) < 20:
            continue

        doc.page_content = cleaned
        processed.append(doc)

    dropped = len(documents) - len(processed)
    if dropped:
        logger.info(f"Dropped {dropped} near-empty documents during preprocessing")

    return processed
