#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# switch-to-caddy.sh  —  Replace nginx with Caddy
# ═══════════════════════════════════════════════════════════════════════
# Caddy advantages over nginx for this setup:
#   ✅  Automatic TLS 1.3 — self-signed or Let's Encrypt with zero config
#   ✅  Built-in rate limiting per IP
#   ✅  Modern security headers out of the box
#   ✅  Simpler, human-readable config
#   ✅  Zero-downtime reloads
#   ✅  Written in Go — fast security patches, no C memory bugs
#
# Run as root:  sudo bash nginx/switch-to-caddy.sh
# ═══════════════════════════════════════════════════════════════════════

set -e
[[ $EUID -ne 0 ]] && { echo "Run as root: sudo bash nginx/switch-to-caddy.sh"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CADDYFILE="${SCRIPT_DIR}/Caddyfile"

GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"
ok()   { echo -e "${GREEN}✅  $*${NC}"; }
warn() { echo -e "${YELLOW}⚠   $*${NC}"; }
die()  { echo -e "${RED}❌  $*${NC}"; exit 1; }

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  iMentor — Switching from nginx to Caddy"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. Install Caddy ───────────────────────────────────────────────────
if ! command -v caddy &>/dev/null; then
    echo "📦 Installing Caddy..."
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
        | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
        | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y caddy
    ok "Caddy installed: $(caddy version)"
else
    ok "Caddy already installed: $(caddy version)"
fi

# ── 2. Stop and disable nginx ─────────────────────────────────────────
echo ""
echo "🛑 Stopping nginx..."
if systemctl is-active --quiet nginx; then
    systemctl stop nginx
    ok "nginx stopped."
fi
systemctl disable nginx 2>/dev/null || true
ok "nginx disabled from autostart."

# ── 3. Install Caddyfile ──────────────────────────────────────────────
echo ""
echo "⚙  Installing Caddyfile..."
[[ -f "$CADDYFILE" ]] || die "Caddyfile not found at: $CADDYFILE"

mkdir -p /etc/caddy
cp "$CADDYFILE" /etc/caddy/Caddyfile
chown root:caddy /etc/caddy/Caddyfile
chmod 640 /etc/caddy/Caddyfile
ok "Caddyfile → /etc/caddy/Caddyfile"

# ── 4. Create log directory ───────────────────────────────────────────
mkdir -p /var/log/caddy
chown caddy:caddy /var/log/caddy
ok "Log directory: /var/log/caddy"

# ── 5. Validate config ────────────────────────────────────────────────
echo ""
echo "🧪 Validating Caddy config..."
caddy validate --config /etc/caddy/Caddyfile || die "Caddyfile has errors. Fix them and re-run."
ok "Config valid."

# ── 6. Enable and start Caddy ─────────────────────────────────────────
echo ""
echo "🚀 Starting Caddy..."
systemctl enable caddy
systemctl restart caddy
sleep 2

if systemctl is-active --quiet caddy; then
    ok "Caddy is running."
else
    die "Caddy failed to start. Check: sudo journalctl -u caddy -n 50"
fi

# ── 7. Update CrowdSec log acquisition (if installed) ─────────────────
if command -v cscli &>/dev/null; then
    echo ""
    echo "🔄 Updating CrowdSec to watch Caddy logs..."
    cat > /etc/crowdsec/acquis.d/imentor-caddy.yaml << 'EOF'
---
filenames:
  - /var/log/caddy/imentor_access.log
labels:
  type: caddy
EOF
    systemctl reload crowdsec 2>/dev/null || true
    ok "CrowdSec updated to parse Caddy logs."
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo -e "${GREEN}  ✅  Caddy is now serving iMentor!${NC}"
echo ""
echo "  Access at:  https://61.0.228.124"
echo "              https://172.180.14.125"
echo "              https://localhost"
echo "  Test:       https://61.0.228.124/testaddr"
echo ""
echo "  Caddy commands:"
echo "   sudo systemctl reload caddy   — reload config (zero-downtime)"
echo "   sudo systemctl status caddy   — check status"
echo "   sudo caddy validate --config /etc/caddy/Caddyfile — test config"
echo "   sudo tail -f /var/log/caddy/imentor_access.log    — access log"
echo "   sudo journalctl -u caddy -f   — system log"
echo ""
echo "  To revert to nginx:"
echo "   sudo systemctl stop caddy && sudo systemctl start nginx"
echo "═══════════════════════════════════════════════════════"
echo ""
