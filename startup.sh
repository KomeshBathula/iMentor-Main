#!/bin/bash
# iMentor Startup Script — Development Mode
# Starts infrastructure via Docker, then RAG + Node.js + Frontend in terminals

set -e

PROJECT_DIR="/home/sri/Downloads/iMentor_march/chatbot"
CONDA_ENV="imentor"
cd "$PROJECT_DIR"

# ── Cleanup ──────────────────────────────────────────────────────────────────
echo "🧹 Cleaning up existing processes..."
lsof -ti:2001 | xargs kill -9 2>/dev/null || true
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
pkill -f "nodemon" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true
pkill -f "python app.py" 2>/dev/null || true
echo "✅ Cleanup complete."
echo ""

# ── Docker Infrastructure ─────────────────────────────────────────────────────
echo "🐳 Starting Docker infrastructure..."
docker compose up -d mongo redis neo4j qdrant elasticsearch sglang

echo "⏳ Waiting for Docker services to be healthy (30s)..."
sleep 3

# Quick health check
echo "🔍 Checking Docker services..."
docker ps --filter "name=imentor" --format "  {{.Names}}: {{.Status}}"
echo ""

# ── Launch Terminals ──────────────────────────────────────────────────────────
echo "🚀 Launching service terminals..."

# Detect conda init script location
CONDA_SH="$HOME/anaconda3/etc/profile.d/conda.sh"
if [ ! -f "$CONDA_SH" ]; then
    CONDA_SH="$HOME/miniconda3/etc/profile.d/conda.sh"
fi
if [ ! -f "$CONDA_SH" ]; then
    CONDA_SH="/opt/conda/etc/profile.d/conda.sh"
fi

gnome-terminal --window \
  --tab --title="🐍 RAG Service (Python)" --working-directory="$PROJECT_DIR" --command="bash -c '
    echo \"================================================\"
    echo \"  Tab 1: Python RAG Service (port 2001)\"
    echo \"================================================\"
    echo \"\"
    # Initialize conda
    if [ -f \"$CONDA_SH\" ]; then
        source \"$CONDA_SH\"
        conda activate $CONDA_ENV
        echo \"✅ conda env: $CONDA_ENV\"
    else
        echo \"⚠️  conda not found — using system Python\"
    fi
    echo \"\"
    echo \"Starting RAG service...\"
    cd \"$PROJECT_DIR/server/rag_service\"
    uvicorn app:app --host 0.0.0.0 --port 2001 --reload
    exec bash
  '" \
  --tab --title="🟢 Node.js Server" --working-directory="$PROJECT_DIR" --command="bash -c '
    echo \"================================================\"
    echo \"  Tab 2: Node.js Backend (port 5001)\"
    echo \"================================================\"
    echo \"\"
    echo \"Waiting 15s for RAG service to start...\"
    sleep 3
    # Check RAG health
    for i in 1 2 3 4 5; do
        if curl -sf http://localhost:2001/health > /dev/null 2>&1; then
            echo \"✅ RAG service is up\"
            break
        fi
        echo \"  Waiting for RAG... (\$i/5)\"
        sleep 5
    done
    echo \"\"
    echo \"Starting Node.js server...\"
    cd \"$PROJECT_DIR/server\"
    npm run dev
    exec bash
  '" \
  --tab --title="⚛️  Frontend (Vite)" --working-directory="$PROJECT_DIR" --command="bash -c '
    echo \"================================================\"
    echo \"  Tab 3: Frontend (port 3000)\"
    echo \"================================================\"
    echo \"\"
    echo \"Waiting 5s for backend to start...\"
    sleep 5
    echo \"\"
    echo \"Starting Vite dev server...\"
    cd \"$PROJECT_DIR/frontend\"
    npm run dev
    exec bash
  '"

echo ""
echo "✨ Terminals launched!"
echo ""
echo "📍 Service URLs:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:5001"
echo "   RAG API:   http://localhost:2001"
echo "   SGLang:    http://localhost:8000"
echo ""
echo "🔑 Login: ultra.boy7@gmail.com / 123456"
echo ""
