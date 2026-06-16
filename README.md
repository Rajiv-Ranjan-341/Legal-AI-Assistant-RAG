---
title: Indian Legal AI Assistant
emoji: ⚖️
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: true
---

<p align="center">
  <img src="logo_rag.png" alt="Indian Legal AI Assistant" width="160" />
</p>

<h1 align="center">Indian Legal AI Assistant</h1>

<p align="center">
  <strong>Hybrid RAG + GraphRAG + Agentic AI for Indian Law</strong><br/>
  Built for <a href="https://unstop.com">The Arch: RAG and Agentic AI Hackathon</a>
</p>

---

An AI-powered legal research assistant that combines **Hybrid RAG**, **Knowledge Graph Expansion**, and **Agentic AI** to answer questions about Indian law with citation-grounded, self-verified responses.

This is not pure RAG. Not pure GraphRAG. It's a **production-grade hybrid** — chunks hold the law text, a knowledge graph captures relationships between them, and an LLM agent orchestrates retrieval, synthesis, and verification.

---

## Problem

Legal research in India is fragmented across hundreds of statutes and thousands of sections. A single legal question can span multiple Acts — arrest provisions in CrPC reference the Constitution, IPC penalties cross-reference definitions from other sections, and compliance scenarios touch dozens of interconnected provisions.

Manual research requires knowing which Act to search, reading dense legal language, and cross-referencing related provisions. Our system automates this entire workflow — from understanding the question, to finding all relevant provisions (including structurally related ones the user didn't ask for), to generating a verified answer with citations.

---

## What Makes This Different

Most RAG systems retrieve chunks independently. If you ask about **arrest without warrant**, a standard system finds Section 41 of CrPC. But the *real* answer requires Section 42 (procedure after arrest), Section 46 (how arrest is made), and Article 21 of the Constitution (right to life and liberty) — provisions that are **legally connected** but may not share any keywords.

Our system solves this with three innovations:

| Innovation | What It Does | Why It Matters |
|------------|-------------|----------------|
| **Knowledge Graph** | Maps cross-references between legal provisions (Section 41 -> Section 42, Section 46, Article 21) | Retrieves structurally related provisions that keyword/semantic search alone would miss |
| **Query Rewriting** | Rewrites casual questions into legal domain terminology before search | "Can police arrest me without notice?" becomes "Arrest without warrant under CrPC provisions" — dramatically better retrieval |
| **Self-Verification** | Agent checks its own answer against sources, detects hallucinations, and self-corrects | Critical for legal domain where a wrong citation is worse than no citation |

---

## System Design

### High-Level Architecture

```
                         User Question
                              |
                              v
                   +---------------------+
                   |   React Frontend    |
                   |  (Vite + Tailwind)  |
                   +---------------------+
                              |
                              v
                   +---------------------+
                   |  FastAPI Backend     |
                   +---------------------+
                              |
                  +-----------+-----------+
                  |                       |
                  v                       v
          Agentic Mode             Direct RAG Mode
                  |                       |
                  v                       v
        +------------------+     Query Rewriter (LLM)
        | LangGraph Agent  |             |
        | (4 Legal Tools)  |             v
        +------------------+     Hybrid Retrieval
                  |              +-------+-------+------+
                  |              |       |       |      |
                  v              v       v       v      |
           Tool Execution    Vector   BM25   Graph     |
                  |          Search  Search Expansion   |
                  |              |       |       |      |
                  |              +-------+-------+      |
                  |                      |              |
                  |              Reciprocal Rank        |
                  |                 Fusion              |
                  |                      |              |
                  |              Cross-Encoder          |
                  |                 Reranker            |
                  |                      |              |
                  v                      v              |
           +------------+        LLM Generation        |
           |  Verifier  |               |              |
           +------------+               v              |
                  |                   Answer            |
                  v                                    |
           Verified Answer                             |
```

### RAG Architecture

The core retrieval-augmented generation pipeline that powers both Direct RAG and the Agentic tools:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RAG PIPELINE                                     │
│                                                                             │
│  ┌──────────────┐    ┌─────────────────────────────────────────────────┐   │
│  │  User Query   │───>│           Query Rewriter (LLM)                 │   │
│  └──────────────┘    │  "Can police arrest me?" ──>                    │   │
│                      │  "Arrest without warrant under CrPC Section 41" │   │
│                      └──────────────────┬──────────────────────────────┘   │
│                                         │                                   │
│                          ┌──────────────┼──────────────┐                   │
│                          │              │              │                    │
│                          v              v              v                    │
│                   ┌────────────┐ ┌────────────┐ ┌──────────────┐          │
│                   │   Dense    │ │   Sparse   │ │  Knowledge   │          │
│                   │  Search    │ │  Search    │ │    Graph     │          │
│                   │ (ChromaDB) │ │ (BM25Okapi)│ │  Expansion   │          │
│                   │            │ │            │ │  (NetworkX)  │          │
│                   │ Semantic   │ │ Keyword    │ │ Cross-ref    │          │
│                   │ similarity │ │ matching   │ │ traversal    │          │
│                   │ top-20     │ │ top-20     │ │ 1-hop        │          │
│                   └─────┬──────┘ └─────┬──────┘ └──────┬───────┘          │
│                         │              │               │                   │
│                         v              v               v                   │
│                   ┌─────────────────────────────────────────┐              │
│                   │       Reciprocal Rank Fusion (RRF)      │              │
│                   │  Merge + deduplicate + score (k=60)     │              │
│                   └────────────────┬────────────────────────┘              │
│                                    │                                       │
│                                    v                                       │
│                   ┌─────────────────────────────────────────┐              │
│                   │     Cross-Encoder Reranker              │              │
│                   │  ms-marco-MiniLM-L-6-v2                 │              │
│                   │  Full attention on (query, chunk) pairs │              │
│                   │  Select top-5                           │              │
│                   └────────────────┬────────────────────────┘              │
│                                    │                                       │
│                                    v                                       │
│                   ┌─────────────────────────────────────────┐              │
│                   │          LLM Generation                 │              │
│                   │  Groq (Llama 3.3 70B) / Gemini 2.0     │              │
│                   │  System prompt + context + question     │              │
│                   │  → Cited, structured legal answer       │              │
│                   └────────────────┬────────────────────────┘              │
│                                    │                                       │
│                                    v                                       │
│                   ┌─────────────────────────────────────────┐              │
│                   │         Self-Verification               │              │
│                   │  Check citations against sources        │              │
│                   │  Detect contradictions & hallucinations │              │
│                   │  ┌──────┐              ┌─────────────┐ │              │
│                   │  │ PASS │──> Answer    │ FAIL (<2x)  │ │              │
│                   │  └──────┘              └──────┬──────┘ │              │
│                   │                               │        │              │
│                   │                     Re-query with      │              │
│                   │                     correction msg     │              │
│                   └─────────────────────────────────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why three retrieval channels?**

| Channel | Finds | Misses |
|---------|-------|--------|
| **Dense (Vector)** | Semantically similar text even with different wording | Exact legal terms, section numbers |
| **Sparse (BM25)** | Exact keyword and section number matches | Paraphrased or conceptually related provisions |
| **Graph Expansion** | Structurally cross-referenced provisions (Section 41 → Section 42, 46, Article 21) | Provisions not explicitly cross-referenced in the text |

No single channel covers everything. RRF fusion combines their strengths — a provision found by 2+ channels ranks highest.

### Ingestion Pipeline (Offline)

```
PDF / TXT Documents
        |
        v
  1. Document Loader           Parse PDFs page-by-page (PyPDF), text files (UTF-8)
        |
        v
  2. Legal Preprocessor        Normalize abbreviations (Sec. -> Section, Art. -> Article)
        |                      Remove page headers, fix hyphenation, drop empty pages
        v
  3. Legal-Aware Chunker       Split at Section/Article/Chapter boundaries
        |                      1000-char chunks, 200-char overlap
        |                      Extract section metadata via regex
        v
  4. Cross-Reference           Regex extraction of legal references:
     Extractor                 "subject to Section 42", "read with Section 46",
        |                      "as defined in Section 300", "punishable under Section 302"
        |                      Classifies: qualifies | procedure | penalty | defines | references | mentions
        v
  5. Vector + BM25 Index       ChromaDB (dense embeddings) + BM25Okapi (sparse, pickled)
        |
        v
  6. Knowledge Graph           NetworkX directed graph
                               Nodes = sections + chunks
                               Edges = cross-references with typed relations
                               Persisted to disk, loaded into memory at runtime
```

### Query Pipeline (Runtime)

```
User: "Can police arrest me without notice?"
                    |
                    v
          Query Rewriter (LLM)
          Rewrites casual language into legal terminology
          -> "Arrest without warrant under CrPC Section 41 provisions"
                    |
                    v
     +--------------+--------------+
     |              |              |
     v              v              v
  Vector         BM25          Graph
  Search         Search        Expansion
  (top 20)       (top 20)     (1-hop neighbors)
     |              |              |
     |   Finds:     |   Finds:    |   Finds:
     |   Sec 41     |   Sec 41    |   Sec 42 (linked)
     |              |             |   Sec 46 (linked)
     |              |             |   Art 21 (linked)
     |              |              |
     +-------+------+--------------+
             |
             v
   Reciprocal Rank Fusion
   Merges and deduplicates results with RRF scoring
             |
             v
   Cross-Encoder Reranker
   Scores each (query, chunk) pair with full attention
   Selects top 5 most relevant
             |
             v
     LLM Generation
     Synthesizes answer with citations
             |
             v
        Verifier
        Checks: citations correct? contradictions? hallucinations?
             |
        +----+----+
        |         |
     Pass       Fail (< 2 attempts)
        |         |
        v         v
     Answer    Re-query with correction message
```

### Agent State Machine (LangGraph)

```
START --> Agent Node --[tool calls]--> Tools Node --> Agent Node (loop)
              |                            |
              |                       (on failure)
         [no tool calls]                   |
              |                     Direct RAG fallback
              v
         Verifier Node --[pass]--> END
              |
         [fail, < 2 attempts]
              |
         Agent Node (with correction message)
```

The agent decides which tools to call based on the question. For "What is the punishment for theft under IPC?", it calls `search_specific_act(query, act_name="IPC")`. For "Is my business compliant with data protection laws?", it calls `generate_compliance_checklist`. If tool-calling fails entirely, the system falls back to Direct RAG — the user always gets an answer.

### Knowledge Graph — How It Works

The graph doesn't replace chunking. It sits **on top of** the chunks.

```
Chunks = the law text
Graph  = relationships between the law text
```

**Example graph structure:**

```
Section 41 (CrPC - Arrest without warrant)
     |
     +--[qualifies]----> Section 42 (Procedure after arrest)
     |
     +--[procedure]----> Section 46 (How arrest is made)
     |
     +--[references]---> Article 21 (Right to life and liberty)

Section 302 (IPC - Punishment for murder)
     |
     +--[defines]------> Section 300 (Definition of murder)
```

**During retrieval:**
1. Vector + BM25 find Section 41 (direct match)
2. Graph expansion follows edges to find Section 42, 46, and Article 21 (structural matches)
3. All results merge into a single ranked list via RRF
4. The reranker picks the most relevant subset

This means the LLM sees the **complete legal picture** — not just the section the user asked about, but all the provisions that law itself references.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Hybrid RAG + GraphRAG** | Vector search + BM25 + Knowledge Graph Expansion, fused with Reciprocal Rank Fusion |
| **Legal Knowledge Graph** | NetworkX graph mapping cross-references between sections/articles across Acts |
| **Query Rewriting** | LLM rewrites casual questions into legal-domain search queries before retrieval |
| **Cross-Encoder Reranking** | Full attention scoring on (query, document) pairs for precision |
| **Legal-Aware Chunking** | Splits at Section/Article/Chapter boundaries, not naive character cuts |
| **Cross-Reference Extraction** | Regex-based extraction of legal citations with typed relations (qualifies, procedure, penalty, defines) |
| **4-Tool Agentic System** | LangGraph agent with legal search, act-specific search, cross-referencing, and compliance tools |
| **Self-Verification** | Agent checks its answer against sources for hallucinations, self-corrects up to 2x |
| **Automatic Fallback** | If agentic mode fails, system falls back to Direct RAG — user always gets an answer |
| **Warm Retrieval** | All indices (Vector DB, BM25, Knowledge Graph, Reranker) loaded once and kept in memory |
| **Persistent Query Log** | Query analytics persisted to disk as JSON, survives server restarts |
| **Configurable CORS** | CORS origins set via environment variable, not hardcoded to `*` |

---

## Frontend

A modern single-page application built with **React 19**, **Vite**, **Tailwind CSS v4**, and **Framer Motion**.

### Chat Interface

- Animated landing page with gradient background effects and cursor-reactive glow
- Compact **pill-shaped input bar** with mode selector (`+` button), auto-resizing textarea, and send button
- Two retrieval modes: **Agentic** (LangGraph agent with tools and self-verification) and **Direct RAG** (hybrid retrieval + LLM generation)
- Streaming-style message bubbles with markdown rendering, verification badges, response time, and copy-to-clipboard
- **Sources panel** slides in from the right showing retrieved legal provisions with rerank scores and expandable excerpts
- Quick suggestion chips on the landing page for common legal queries

### Collapsible Sidebar

- Toggle between expanded (220px) and collapsed (56px icon-only) states
- Navigation links: Chat, Documents, Analytics
- **Chat history** with recent conversations listed under "Recent" section
- Click any history item to reload that conversation
- Search filter to find past chats by title
- Delete individual chats on hover

### Document Browser

- Lists all ingested legal documents with page/chunk counts
- Click a document to browse its chunks with pagination
- Search within a document's chunks
- Right panel shows document stats and section distribution with progress bars

### Analytics Dashboard

- Metric cards: total documents, chunks indexed, average response time, queries today
- **Chunks per Document** bar chart and **Document Distribution** pie chart (Recharts)
- Recent queries table with mode badges, response times, and verification status

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| LLM | Groq (Llama 3.3 70B) / Google Gemini 2.0 Flash / Ollama (local) |
| Embeddings | `BAAI/bge-small-en-v1.5` (384-dim, sentence-transformers) |
| Vector DB | ChromaDB |
| Sparse Search | BM25Okapi (rank_bm25) |
| Knowledge Graph | NetworkX (directed graph, pickled to disk) |
| Reranker | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| Agent Framework | LangGraph (state machine with conditional edges) |
| Backend | FastAPI (async, CORS-enabled) |
| Frontend | React 19 + Vite + Tailwind CSS v4 + Framer Motion + Recharts |
| Markdown | react-markdown + remark-gfm |
| UI Components | Radix UI (dropdown menu, slot) + shadcn/ui primitives |
| Evaluation | RAGAS (faithfulness, answer relevancy, context precision) |
| Testing | pytest + httpx (FastAPI TestClient) |
| Config | Pydantic Settings (.env-driven) |

---

## Agent Tools

| Tool | Purpose | Query Rewrite |
|------|---------|---------------|
| `search_legal_database` | General hybrid search + rerank for broad legal questions | Yes (raw user query) |
| `search_specific_act` | Filters results by a specific Act (IPC, CrPC, Constitution, etc.) | No (already act-prefixed) |
| `cross_reference_sections` | Finds a specific section/article and related provisions | No (already precise reference) |
| `generate_compliance_checklist` | Multi-query retrieval for compliance scenarios | No (already domain sub-queries) |

---

## Setup

```bash
# 1. Create environment
python -m venv venv && source venv/Scripts/activate   # Windows
# source venv/bin/activate                             # Linux/Mac
pip install -r requirements.txt

# 2. Configure
cp .env.example .env
# Add your API keys:
#   GROQ_API_KEY=gsk_...       (free at console.groq.com)
#   GEMINI_API_KEY=...         (free at aistudio.google.com)
#   LLM_PROVIDER=groq          (or gemini / local)
#   CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# 3. Add legal PDFs to data/raw/

# 4. Ingest (builds vector index, BM25 index, and knowledge graph)
python -m scripts.ingest

# 5. Run backend
python -m api.main                         # FastAPI at localhost:8000

# 6. Run frontend
cd frontend && npm install && npm run dev  # React app at localhost:3000

# 7. Run tests
python -m pytest tests/ -v
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/query` | Query the system (body: `{question, mode: "direct"\|"agentic"}`) |
| `GET` | `/documents` | List all ingested documents with chunk stats |
| `GET` | `/documents/{filename}/chunks` | Browse chunks of a specific document (paginated, searchable) |
| `GET` | `/graph/stats` | Knowledge graph statistics (nodes, edges, top connected sections) |
| `GET` | `/analytics` | System analytics (queries, response times, graph stats) |
| `POST` | `/evaluate` | Run RAGAS evaluation pipeline (faithfulness, relevancy, precision) |
| `GET` | `/health` | Health check |

---

## Legal Corpus

Currently indexed from 13 documents:

- Constitution of India
- Indian Penal Code (IPC)
- Code of Criminal Procedure (CrPC), 1973
- Indian Evidence Act, 1872
- Criminal Law (Amendment) Act, 2013
- The Companies Act, 2013
- IT Act, 2000
- Aadhaar Act, 2016
- Additional criminal law and amendment statutes

---

## Project Structure

```
config/
  settings.py                    Centralized config (Pydantic Settings, .env-driven)

src/
  llm/
    factory.py                   LLM factory (Gemini / Groq / Ollama)

  ingestion/
    loader.py                    PDF + TXT document loader
    preprocessor.py              Legal text normalization (abbreviations, headers, hyphenation)
    chunker.py                   Legal-aware chunking (Section/Article/Chapter boundaries)
    reference_extractor.py       Cross-reference extraction with relation classification

  retrieval/
    embeddings.py                Embedding model loader (sentence-transformers)
    vector_store.py              ChromaDB vector store (create, load, search)
    bm25_store.py                BM25 sparse index (build, search, in-memory cache)
    knowledge_graph.py           Legal knowledge graph (build, expand, stats)
    hybrid_search.py             Hybrid retrieval (vector + BM25 + graph + RRF)
    reranker.py                  Cross-encoder reranker
    query_rewriter.py            LLM-based query rewriting for legal domain

  agents/
    graph.py                     LangGraph agent state machine
    tools.py                     4 legal retrieval tools
    prompts.py                   System, verification, and query planner prompts
    rag_chain.py                 Direct RAG fallback chain

  evaluation/
    metrics.py                   RAGAS evaluation pipeline (also exposed via POST /evaluate)

api/
  main.py                        FastAPI backend (query, documents, graph, analytics, evaluation)

frontend/
  src/
    App.jsx                      Root app with routing and chat context provider
    main.jsx                     Vite entry point

    components/
      Sidebar.jsx                Collapsible sidebar with nav, chat history, search
      ChatMessage.jsx            Message bubble with react-markdown, verification, copy
      SourcePanel.jsx            Retrieved sources panel with rerank scores

      ui/
        animated-ai-chat.tsx     Main chat interface (landing + conversation states)
        button.tsx               Button primitive (shadcn/ui)
        dropdown-menu.tsx        Dropdown menu (Radix UI)
        textarea.tsx             Textarea primitive (shadcn/ui)

    pages/
      Documents.jsx              Document browser with chunk viewer and stats
      Analytics.jsx              Analytics dashboard with charts and query log

    lib/
      api.js                     Axios API client (query, documents, analytics)
      chat-context.jsx           Chat state context (messages, history, persistence)
      utils.ts                   Utility functions (cn)

tests/
  test_preprocessor.py           Legal text preprocessing tests
  test_chunker.py                Chunking and section metadata extraction tests
  test_reference_extractor.py    Cross-reference extraction and classification tests
  test_hybrid_search.py          Reciprocal Rank Fusion tests
  test_config.py                 Settings and configuration tests
  test_api.py                    FastAPI endpoint integration tests

scripts/
  ingest.py                      Ingestion pipeline CLI (6 steps)

.env.example                     Environment variable template (copy to .env)
data/raw/                        Source PDFs and text files
chroma_db/                       Persisted indices (ChromaDB, BM25, knowledge graph, query log)
```

---

## Performance Optimizations

| Optimization | Before | After |
|-------------|--------|-------|
| **BM25 Index** | Loaded from disk on every search call | Loaded once, cached in memory |
| **Knowledge Graph** | (didn't exist) | Loaded once, cached in memory |
| **Vector Store** | New ChromaDB connection per search | Singleton, reused across queries |
| **Reranker Model** | Already singleton | Already singleton |
| **Query Rewriter LLM** | (didn't exist) | LLM instance cached after first call |
| **Query Log** | In-memory only, lost on restart | Persisted to JSON, loaded on startup |

All retrieval components are **kept warm in memory** after first load. First query pays the cold-load cost; every subsequent query hits memory directly.

---

## How Each Component Improves Answer Quality

```
Component               | What it catches that others miss
------------------------|---------------------------------------------------
Vector Search           | Semantically similar provisions (meaning-based)
BM25 Search             | Exact term matches (keyword-based)
Knowledge Graph         | Structurally related provisions (cross-referenced)
Query Rewriter          | Bridges gap between casual language and legal terms
Cross-Encoder Reranker  | Filters noise — often matters more than the LLM choice
Self-Verification       | Catches hallucinated citations and contradictions
```

---

## Example Walkthrough

**User asks:** "Can police arrest me without notice?"

**Step 1 — Query Rewrite:**
```
"Can police arrest me without notice?"
  -> "Arrest without warrant by police officer under CrPC provisions"
```

**Step 2 — Hybrid Retrieval:**
```
Vector Search  -> Section 41 CrPC (arrest without warrant)
BM25 Search    -> Section 41, Section 151 CrPC (preventive arrest)
Graph Expand   -> Section 42 (procedure after arrest)
                  Section 46 (how arrest is made)
                  Article 21 (right to life and liberty)
```

**Step 3 — Rerank:** Cross-encoder scores all candidates, selects top 5.

**Step 4 — LLM Generation:** Synthesizes a comprehensive answer citing all relevant provisions.

**Step 5 — Verification:** Checks every citation against sources. If Section 42 was misquoted, the agent self-corrects.

**Final Answer:** A verified, multi-provision response covering arrest powers (Sec 41), procedure (Sec 42, 46), constitutional safeguards (Art 21), and preventive arrest (Sec 151).

---

## Testing

32 tests covering the core pipeline components:

```bash
python -m pytest tests/ -v
```

| Test File | Covers |
|-----------|--------|
| `test_preprocessor.py` | Text cleaning, legal reference normalization, empty document filtering |
| `test_chunker.py` | Section metadata extraction, legal-aware chunking with boundary splits |
| `test_reference_extractor.py` | Cross-reference regex extraction, relation classification, deduplication |
| `test_hybrid_search.py` | Reciprocal Rank Fusion merging, scoring, edge cases |
| `test_config.py` | Settings defaults, CORS config, model paths |
| `test_api.py` | Health, documents, analytics, graph stats endpoints, request validation |

---

Built for **The Arch: RAG and Agentic AI Hackathon** on Unstop.
