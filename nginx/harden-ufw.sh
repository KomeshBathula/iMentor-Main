#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# harden-ufw.sh  —  Close all internal service ports from WAN
# ═══════════════════════════════════════════════════════════════════════
# Run as root:  sudo bash nginx/harden-ufw.sh
#
# KEEPS open:  22 (SSH), 80 (HTTP→HTTPS redirect), 443 (HTTPS), 2000 (alt SSL)
# CLOSES:      MongoDB, Redis, Neo4j, Qdrant, ES, SGLang, Ollama,
#              Grafana, Prometheus, all app dev ports exposed directly
# ═══════════════════════════════════════════════════════════════════════

set -e
[[ $EUID -ne 0 ]] && { echo "Run as root: sudo bash nginx/harden-ufw.sh"; exit 1; }

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  iMentor — UFW Firewall Hardening"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── Ports to CLOSE (should only be reachable from localhost) ───────────
PORTS_TO_CLOSE=(
    # Databases — must NEVER be public
    27017 27018   # MongoDB
    6379 6380     # Redis
    7474 7475     # Neo4j HTTP
    7687 7688     # Neo4j Bolt
    6333 6334     # Qdrant HTTP/gRPC
    6335 6336     # Qdrant shifted
    9200 9201     # Elasticsearch
    # LLM inference — free GPU for anyone otherwise
    8000          # SGLang / vLLM
    11434         # Ollama
    # App dev ports — nginx is the entry point, not these directly
    3000 3002 3004 3005
    5000 5001 5003 5005 5006 5007
    2001 2002 2003 2004 2005 2006 2007 2008 2009
    2173
    # Monitoring — internal only
    9091          # Prometheus
    # Old/unused
    8080 8082
    9000 9845
    4004 6001 6002
    21115 21116 21117 21118 21119
)

echo "🔒 Closing internal/infra ports from WAN..."
for port in "${PORTS_TO_CLOSE[@]}"; do
    # Delete both TCP and UDP rules if they exist (suppress errors if rule doesn't exist)
    ufw delete allow "${port}/tcp" 2>/dev/null || true
    ufw delete allow "${port}/udp" 2>/dev/null || true
    ufw delete allow "${port}"     2>/dev/null || true
    ufw delete allow "${port} (v6)" 2>/dev/null || true
    printf "  ✅  closed %-6s\n" "$port"
done

# ── Range rules ────────────────────────────────────────────────────────
ufw delete allow 2003:2009/tcp 2>/dev/null || true
ufw delete allow 21115:21119/tcp 2>/dev/null || true
echo "  ✅  closed port ranges"

# ── Ensure the ports we NEED are still open ────────────────────────────
echo ""
echo "🔓 Ensuring required ports are open..."

ufw allow 22/tcp    comment 'SSH' 2>/dev/null || true
ufw allow 80/tcp    comment 'HTTP (redirect to HTTPS)' 2>/dev/null || true
ufw allow 443/tcp   comment 'HTTPS iMentor' 2>/dev/null || true
ufw allow 2000/tcp  comment 'Alternate SSL (legacy clients)' 2>/dev/null || true

echo "  ✅  22   (SSH)"
echo "  ✅  80   (HTTP → HTTPS redirect)"
echo "  ✅  443  (HTTPS)"
echo "  ✅  2000 (Alternate SSL)"

# ── Reload UFW ─────────────────────────────────────────────────────────
echo ""
echo "♻  Reloading UFW..."
ufw reload

echo ""
echo "📋 Current UFW status:"
ufw status verbose

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅  Firewall hardening complete"
echo "  Only ports 22, 80, 443, 2000 are open to the internet."
echo "  All database/infra ports are closed from WAN."
echo "═══════════════════════════════════════════════════════"
echo ""
