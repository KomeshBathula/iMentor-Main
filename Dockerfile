# ─────────────────────────────────────────────────────────────────────────────
# iMentor — Multi-stage Dockerfile
#
# Stages:
#   base      → Shared OS + Python dependencies
#   server    → Node.js Express backend (Port 5001)
#   frontend  → React/Vite frontend (Port 3000)
# ─────────────────────────────────────────────────────────────────────────────

# =============================================================================
# STAGE 1: Base Image
# =============================================================================
FROM node:20-bookworm-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-dev \
    python3-pip \
    build-essential \
    libpq-dev \
    curl \
    git \
    ffmpeg \
    libsm6 \
    libxext6 \
    tesseract-ocr \
    libtesseract-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# =============================================================================
# STAGE 2: Server
# =============================================================================
FROM base AS server

WORKDIR /app/server

# Copy package files first (better caching)
COPY server/package*.json ./

RUN npm ci --omit=dev || npm install --omit=dev

# Copy server source
COPY server/ .

# Create non-root user
RUN groupadd -r appgroup && \
    useradd -r -g appgroup appuser && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 5001

HEALTHCHECK --interval=30s \
            --timeout=5s \
            --start-period=30s \
            --retries=3 \
CMD curl -f http://localhost:5001/ || exit 1

CMD ["node", "server.js"]


# =============================================================================
# STAGE 3: Frontend
# =============================================================================
FROM node:20-bookworm-slim AS frontend

WORKDIR /app/frontend

# Copy package files first
COPY frontend/package*.json ./

RUN npm ci || npm install

# Copy frontend source
COPY frontend/ .

# Copy PDF worker if available
RUN mkdir -p public && \
    cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/ 2>/dev/null || true

# Create non-root user
RUN groupadd -r appgroup && \
    useradd -r -g appgroup appuser && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "3000"]