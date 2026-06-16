import re
from langchain_core.documents import Document
from loguru import logger


CROSS_REF_PATTERNS = [
    re.compile(
        r"(?:subject to|under|see|read with|refer(?:s? to)?|"
        r"notwithstanding anything (?:contained )?in|"
        r"in accordance with|as (?:provided|defined|specified) (?:in|under)|"
        r"within the meaning of|"
        r"punishable under|mentioned in|described in|"
        r"except as provided in|save as provided in)\s+"
        r"((?:Section|Article|Rule|Order|Clause|Schedule)\s+\d+[A-Za-z]*)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(Section|Article|Rule|Order|Clause|Schedule)\s+(\d+[A-Za-z]*)\s+"
        r"(?:of|of the)\s+"
        r"((?:the\s+)?(?:Constitution|Indian Penal Code|IPC|"
        r"Code of Criminal Procedure|CrPC|CPC|"
        r"Bharatiya Nyaya Sanhita|BNS|"
        r"Bharatiya Nagarik Suraksha Sanhita|BNSS|"
        r"Indian Evidence Act|"
        r"Code of Civil Procedure|"
        r"Criminal Law[^,\n]{0,40}))",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:Section|Article)s?\s+(\d+[A-Za-z]*)\s*(?:,\s*(\d+[A-Za-z]*))*\s+and\s+(\d+[A-Za-z]*)",
        re.IGNORECASE,
    ),
]

STANDALONE_REF = re.compile(
    r"\b(Section|Article)\s+(\d+[A-Za-z]*(?:\s*\(\d+\))?)",
    re.IGNORECASE,
)


def _normalize_ref(ref: str) -> str:
    ref = re.sub(r"\s+", " ", ref.strip())
    ref = re.sub(r"^(section|article|rule|order|clause|schedule)", lambda m: m.group().capitalize(), ref, flags=re.IGNORECASE)
    return ref


def extract_references_from_chunk(chunk: Document) -> list[dict]:
    text = chunk.page_content
    source_section = chunk.metadata.get("legal_section", "")
    source_file = chunk.metadata.get("source_file", "")

    if not source_section:
        return []

    refs = []
    seen = set()

    for pattern in CROSS_REF_PATTERNS:
        for match in pattern.finditer(text):
            full = match.group(0)
            for ref in STANDALONE_REF.finditer(full):
                target = _normalize_ref(f"{ref.group(1)} {ref.group(2)}")
                if target != _normalize_ref(source_section) and target not in seen:
                    seen.add(target)
                    refs.append({
                        "source": _normalize_ref(source_section),
                        "target": target,
                        "source_file": source_file,
                        "context": full[:120],
                        "relation": _classify_relation(full),
                    })

    all_mentioned = set()
    for ref in STANDALONE_REF.finditer(text):
        target = _normalize_ref(f"{ref.group(1)} {ref.group(2)}")
        all_mentioned.add(target)

    for target in all_mentioned:
        if target != _normalize_ref(source_section) and target not in seen:
            seen.add(target)
            refs.append({
                "source": _normalize_ref(source_section),
                "target": target,
                "source_file": source_file,
                "context": "",
                "relation": "mentions",
            })

    return refs


def _classify_relation(context: str) -> str:
    ctx = context.lower()
    if any(kw in ctx for kw in ["subject to", "notwithstanding"]):
        return "qualifies"
    if any(kw in ctx for kw in ["punishable under", "penalty"]):
        return "penalty"
    if any(kw in ctx for kw in ["read with", "in accordance with"]):
        return "procedure"
    if any(kw in ctx for kw in ["as defined", "as provided", "as specified", "within the meaning"]):
        return "defines"
    return "references"


def extract_all_references(chunks: list[Document]) -> list[dict]:
    all_refs = []
    for chunk in chunks:
        refs = extract_references_from_chunk(chunk)
        all_refs.extend(refs)

    unique = {}
    for ref in all_refs:
        key = (ref["source"], ref["target"])
        if key not in unique or ref["context"]:
            unique[key] = ref

    result = list(unique.values())
    logger.info(
        f"Extracted {len(result)} unique cross-references "
        f"from {len(chunks)} chunks"
    )
    return result
