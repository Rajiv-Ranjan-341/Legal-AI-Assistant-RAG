from langchain_core.messages import SystemMessage, HumanMessage
from src.llm import get_llm
from loguru import logger

_rewriter_llm = None

REWRITE_PROMPT = """You are a legal query rewriter for an Indian law retrieval system.

Rewrite the user's question into a search query optimized for retrieving relevant legal provisions.

Rules:
- Use formal legal terminology (e.g. "arrest" not "caught", "cognizable offence" not "serious crime")
- Reference specific Acts when identifiable (IPC, CrPC, Constitution, BNS, BNSS, Evidence Act)
- Expand abbreviations and colloquial terms into legal language
- Keep the rewrite concise — one or two sentences maximum
- If the query already uses precise legal terms, return it mostly unchanged
- Do NOT answer the question — only rewrite it for search

Return ONLY the rewritten query, nothing else."""


def rewrite_query(query: str) -> str:
    global _rewriter_llm

    if _rewriter_llm is None:
        _rewriter_llm = get_llm(temperature=0, max_tokens=150)

    try:
        response = _rewriter_llm.invoke([
            SystemMessage(content=REWRITE_PROMPT),
            HumanMessage(content=query),
        ])
        rewritten = response.content.strip().strip('"')

        if len(rewritten) < 5 or len(rewritten) > 500:
            return query

        logger.info(f"Query rewrite: \"{query}\" → \"{rewritten}\"")
        return rewritten

    except Exception as e:
        logger.warning(f"Query rewrite failed ({type(e).__name__}), using original")
        return query
