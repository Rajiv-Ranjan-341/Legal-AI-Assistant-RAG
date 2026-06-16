# ── Stage 1: Build React frontend ──
FROM node:20-slim AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python runtime ──
FROM python:3.11-slim

RUN useradd -m -u 1000 user
WORKDIR /home/user/app

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download ML models so startup is faster
RUN python -c "\
from sentence_transformers import SentenceTransformer, CrossEncoder; \
SentenceTransformer('BAAI/bge-small-en-v1.5'); \
CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')"

COPY --chown=user config/ config/
COPY --chown=user src/ src/
COPY --chown=user api/ api/
COPY --chown=user scripts/ scripts/
COPY --chown=user chroma_db/ chroma_db/
COPY --chown=user data/raw/ data/raw/

COPY --from=frontend-build --chown=user /build/dist frontend/dist/

USER user

ENV PORT=7860
EXPOSE 7860

CMD ["python", "-m", "api.main"]
