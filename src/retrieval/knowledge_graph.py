import pickle
from pathlib import Path
from collections import defaultdict

import networkx as nx
from langchain_core.documents import Document
from loguru import logger

GRAPH_CACHE_PATH = Path("./chroma_db/legal_graph.pkl")

_graph_cache: dict | None = None


def build_knowledge_graph(
    chunks: list[Document],
    references: list[dict],
) -> nx.DiGraph:
    global _graph_cache

    graph = nx.DiGraph()

    section_to_chunks: dict[str, list[int]] = defaultdict(list)
    for idx, chunk in enumerate(chunks):
        section = chunk.metadata.get("legal_section", "")
        if section:
            section_to_chunks[section].append(idx)

        graph.add_node(
            idx,
            type="chunk",
            section=section,
            source_file=chunk.metadata.get("source_file", ""),
            page=chunk.metadata.get("page", ""),
            content_preview=chunk.page_content[:100],
        )

    for section, chunk_ids in section_to_chunks.items():
        graph.add_node(
            section,
            type="section",
            chunk_ids=chunk_ids,
        )
        for cid in chunk_ids:
            graph.add_edge(section, cid, relation="contains")
            graph.add_edge(cid, section, relation="belongs_to")

    ref_count = 0
    for ref in references:
        source_sec = ref["source"]
        target_sec = ref["target"]

        if source_sec not in graph:
            graph.add_node(source_sec, type="section", chunk_ids=[])
        if target_sec not in graph:
            graph.add_node(target_sec, type="section", chunk_ids=[])

        graph.add_edge(
            source_sec,
            target_sec,
            relation=ref.get("relation", "references"),
            context=ref.get("context", ""),
        )
        ref_count += 1

    GRAPH_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(GRAPH_CACHE_PATH, "wb") as f:
        pickle.dump({"graph": graph, "chunks": chunks}, f)

    _graph_cache = {"graph": graph, "chunks": chunks}

    section_nodes = sum(1 for _, d in graph.nodes(data=True) if d.get("type") == "section")
    logger.info(
        f"Knowledge graph built: {graph.number_of_nodes()} nodes "
        f"({section_nodes} sections, {len(chunks)} chunks), "
        f"{ref_count} cross-reference edges"
    )
    return graph


def _load_graph() -> tuple[nx.DiGraph, list[Document]]:
    global _graph_cache

    if _graph_cache is not None:
        return _graph_cache["graph"], _graph_cache["chunks"]

    if not GRAPH_CACHE_PATH.exists():
        raise FileNotFoundError("Knowledge graph not found. Run ingestion first.")

    with open(GRAPH_CACHE_PATH, "rb") as f:
        _graph_cache = pickle.load(f)

    logger.info(f"Knowledge graph loaded into memory ({_graph_cache['graph'].number_of_nodes()} nodes)")
    return _graph_cache["graph"], _graph_cache["chunks"]


def graph_expand(
    seed_sections: list[str],
    top_k: int = 10,
    max_hops: int = 1,
) -> list[Document]:
    graph, chunks = _load_graph()

    expanded_sections: set[str] = set()
    frontier = set(seed_sections)

    for _ in range(max_hops):
        next_frontier = set()
        for section in frontier:
            if section not in graph:
                continue
            for neighbor in graph.neighbors(section):
                node_data = graph.nodes[neighbor]
                if node_data.get("type") == "section" and neighbor not in expanded_sections:
                    next_frontier.add(neighbor)
            for predecessor in graph.predecessors(section):
                node_data = graph.nodes[predecessor]
                if node_data.get("type") == "section" and predecessor not in expanded_sections:
                    next_frontier.add(predecessor)

        expanded_sections.update(frontier)
        frontier = next_frontier - expanded_sections

    expanded_sections.update(frontier)
    expanded_sections -= set(seed_sections)

    edge_scores = {}
    for section in expanded_sections:
        if section in graph:
            in_degree = graph.in_degree(section)
            out_degree = graph.out_degree(section)
            edge_scores[section] = in_degree + out_degree

    section_ranked = sorted(expanded_sections, key=lambda s: edge_scores.get(s, 0), reverse=True)

    ranked_chunks = []
    seen = set()
    for section in section_ranked:
        if section in graph:
            for cid in graph.nodes[section].get("chunk_ids", []):
                if cid not in seen and cid < len(chunks):
                    seen.add(cid)
                    doc = Document(
                        page_content=chunks[cid].page_content,
                        metadata={**chunks[cid].metadata, "retrieval_source": "graph_expansion"},
                    )
                    ranked_chunks.append(doc)

    logger.info(
        f"Graph expansion: {len(seed_sections)} seeds → "
        f"{len(expanded_sections)} related sections → "
        f"{len(ranked_chunks)} chunks"
    )
    return ranked_chunks[:top_k]


def get_graph_stats() -> dict:
    try:
        graph, chunks = _load_graph()
    except FileNotFoundError:
        return {}

    section_nodes = [n for n, d in graph.nodes(data=True) if d.get("type") == "section"]
    chunk_nodes = [n for n, d in graph.nodes(data=True) if d.get("type") == "chunk"]

    ref_edges = [
        (u, v, d) for u, v, d in graph.edges(data=True)
        if d.get("relation") not in ("contains", "belongs_to")
    ]

    relation_counts = defaultdict(int)
    for _, _, d in ref_edges:
        relation_counts[d.get("relation", "unknown")] += 1

    top_connected = sorted(
        section_nodes,
        key=lambda s: graph.degree(s),
        reverse=True,
    )[:10]

    return {
        "total_nodes": graph.number_of_nodes(),
        "section_nodes": len(section_nodes),
        "chunk_nodes": len(chunk_nodes),
        "total_edges": graph.number_of_edges(),
        "cross_reference_edges": len(ref_edges),
        "relation_types": dict(relation_counts),
        "top_connected_sections": [
            {"section": s, "connections": graph.degree(s)}
            for s in top_connected
        ],
    }
