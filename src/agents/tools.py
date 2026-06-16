from langchain_core.tools import tool
from langchain_core.documents import Document
from src.retrieval.hybrid_search import hybrid_search
from src.retrieval.reranker import rerank


@tool
def search_legal_database(query: str) -> str:
    """Search the Indian legal knowledge base using hybrid retrieval (dense + BM25) with reranking.
    Use this to find relevant sections, articles, or provisions from Indian law."""
    results = hybrid_search(query, top_k=20)
    reranked = rerank(query, results, top_k=5)
    return _format_results(reranked)


@tool
def search_specific_act(query: str, act_name: str) -> str:
    """Search within a specific Indian Act or legal document.
    Use when the user asks about a particular Act like IPC, CrPC, Constitution, etc."""
    enhanced_query = f"{act_name}: {query}"
    results = hybrid_search(enhanced_query, top_k=20, rewrite=False)

    filtered = [
        doc for doc in results
        if act_name.lower() in doc.metadata.get("source_file", "").lower()
    ]
    if not filtered:
        filtered = results

    reranked = rerank(query, filtered[:15], top_k=5)
    return _format_results(reranked)


@tool
def cross_reference_sections(section_ref: str) -> str:
    """Cross-reference a specific legal section (e.g., 'Section 302 IPC', 'Article 21').
    Finds the referenced section and related provisions."""
    results = hybrid_search(section_ref, top_k=10, rewrite=False)
    reranked = rerank(section_ref, results, top_k=3)
    return _format_results(reranked)


@tool
def generate_compliance_checklist(scenario: str) -> str:
    """Given a legal scenario or business situation, retrieve relevant legal provisions
    that should be checked for compliance. Returns structured context for checklist generation."""
    queries = [
        f"legal requirements for {scenario}",
        f"penalties and offences related to {scenario}",
        f"compliance obligations for {scenario}",
    ]

    all_results = []
    for q in queries:
        results = hybrid_search(q, top_k=10, rewrite=False)
        all_results.extend(results)

    seen = set()
    unique = []
    for doc in all_results:
        key = doc.page_content[:100]
        if key not in seen:
            seen.add(key)
            unique.append(doc)

    reranked = rerank(scenario, unique[:20], top_k=7)
    return _format_results(reranked)


def _format_results(documents: list[Document]) -> str:
    if not documents:
        return "No relevant legal provisions found."

    parts = []
    for i, doc in enumerate(documents, 1):
        source = doc.metadata.get("source_file", "Unknown")
        section = doc.metadata.get("legal_section", "")
        page = doc.metadata.get("page", "")
        score = doc.metadata.get("rerank_score", 0)
        retrieval = doc.metadata.get("retrieval_source", "")

        header = f"[Source {i}] {source}"
        if section:
            header += f" | {section}"
        if page:
            header += f" | Page {page}"
        header += f" | Relevance: {score:.3f}"
        if retrieval == "graph_expansion":
            header += " | [Graph-linked]"

        parts.append(f"{header}\n{doc.page_content}")

    return "\n\n---\n\n".join(parts)
