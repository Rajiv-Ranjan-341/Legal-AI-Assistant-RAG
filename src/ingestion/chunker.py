import re
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from config.settings import settings
from loguru import logger


LEGAL_SECTION_PATTERN = re.compile(
    r"^(?:Section|Article|Chapter|Part|Schedule|Rule|Order|Clause)\s+\d+",
    re.IGNORECASE | re.MULTILINE,
)

LEGAL_SEPARATORS = [
    "\n\nChapter ",
    "\n\nPart ",
    "\n\nSection ",
    "\n\nArticle ",
    "\n\nSchedule ",
    "\n\nRule ",
    "\n\n",
    "\n",
    ". ",
    " ",
]


def extract_section_metadata(text: str) -> dict:
    metadata = {}
    match = LEGAL_SECTION_PATTERN.search(text[:200])
    if match:
        metadata["legal_section"] = match.group(0).strip()
    return metadata


def chunk_legal_documents(
    documents: list[Document],
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[Document]:
    chunk_size = chunk_size or settings.chunk_size
    chunk_overlap = chunk_overlap or settings.chunk_overlap

    splitter = RecursiveCharacterTextSplitter(
        separators=LEGAL_SEPARATORS,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        add_start_index=True,
    )

    chunks = splitter.split_documents(documents)

    for chunk in chunks:
        section_meta = extract_section_metadata(chunk.page_content)
        chunk.metadata.update(section_meta)
        chunk.metadata["chunk_length"] = len(chunk.page_content)

    logger.info(
        f"Created {len(chunks)} chunks from {len(documents)} documents "
        f"(size={chunk_size}, overlap={chunk_overlap})"
    )
    return chunks
