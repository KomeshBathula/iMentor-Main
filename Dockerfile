# ─────────────────────────────────────────────────────────────────────────────
# iMentor — Multi-stage Dockerfile
#
# Stages:
#   base      → shared OS + Python deps
#   server    → Node.js Express backend  (port 5001)
#   frontend  → Vite React dev server    (port 3000)
#
# Build a specific stage:
#   docker compose build server
#   docker build --target server -t imentor-server .
# ─────────────────────────────────────────────────────────────────────────────

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE: base — shared system dependencies
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:20-bookworm-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-dev python3-pip \
    build-essential libpq-dev curl git \
    ffmpeg libsm6 libxext6 \
    tesseract-ocr libtesseract-dev \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE: server — Node.js Express backend
# ═══════════════════════════════════════════════════════════════════════════════
FROM base AS server

WORKDIR /app/server
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

EXPOSE 5001
CMD ["node", "server.js"]



# ═══════════════════════════════════════════════════════════════════════════════
# STAGE: frontend — Vite React dev / build
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:20-bookworm-slim AS frontend

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci 2>/dev/null || npm install

COPY frontend/ .
RUN mkdir -p public \
    && cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/ 2>/dev/null || true

EXPOSE 3000
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "3000"]
