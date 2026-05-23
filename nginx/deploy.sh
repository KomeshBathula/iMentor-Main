#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# deploy.sh  —  Restore iMentor Nginx config after a fresh OS install
# ═══════════════════════════════════════════════════════════════════════
#
# USAGE (run from the project root):
#   sudo bash nginx/deploy.sh
#
# What this script does:
#   1. Installs nginx if missing
#   2. Installs the SSL certificate and private key into /etc/ssl/
#   3. Copies the site config to /etc/nginx/sites-available/
#   4. Enables the site (symlink in sites-enabled/)
#   5. Tests the nginx config and reloads the service
#
# PREREQUISITE — the private key must exist at:
#   nginx/certs/interactive-learning.key
# If it's missing, run:
#   cd nginx/certs && bash gen-selfsigned.sh
# ═══════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NGINX_DIR="${SCRIPT_DIR}"

CERT_SRC="${NGINX_DIR}/certs/interactive-learning.crt"
KEY_SRC="${NGINX_DIR}/certs/interactive-learning.key"
SITE_SRC="${NGINX_DIR}/sites-available/000-unified"

CERT_DST="/etc/ssl/certs/interactive-learning.crt"
KEY_DST="/etc/ssl/private/interactive-learning.key"
SITE_DST="/etc/nginx/sites-available/000-unified"
SITE_LINK="/etc/nginx/sites-enabled/000-unified"

# ── Colour helpers ─────────────────────────────────────────────────────
GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"
ok()   { echo -e "${GREEN}✅  $*${NC}"; }
warn() { echo -e "${YELLOW}⚠   $*${NC}"; }
die()  { echo -e "${RED}❌  $*${NC}"; exit 1; }

# ── Root check ─────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && die "Please run as root: sudo bash nginx/deploy.sh"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  iMentor — Nginx deployment / restore script"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. Install nginx ───────────────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
    warn "nginx not found — installing..."
    apt-get update -qq && apt-get install -y nginx
    ok "nginx installed."
else
    ok "nginx is already installed ($(nginx -v 2>&1 | head -1))."
fi

# ── 2. Install SSL certificate ─────────────────────────────────────────
[[ -f "${CERT_SRC}" ]] || die "Certificate not found: ${CERT_SRC}"

echo ""
echo "📜 Installing SSL certificate..."
cp "${CERT_SRC}" "${CERT_DST}"
chmod 644 "${CERT_DST}"
ok "Certificate → ${CERT_DST}"

# ── 3. Install SSL private key ─────────────────────────────────────────
echo ""
echo "🔑 Installing SSL private key..."

if [[ -f "${KEY_SRC}" ]]; then
    cp "${KEY_SRC}" "${KEY_DST}"
    chmod 600 "${KEY_DST}"
    ok "Private key → ${KEY_DST}"
else
    warn "Private key not found at: ${KEY_SRC}"
    warn "Generating a new self-signed key+cert pair..."
    bash "${NGINX_DIR}/certs/gen-selfsigned.sh"
    cp "${KEY_SRC}" "${KEY_DST}"
    chmod 600 "${KEY_DST}"
    # Also overwrite the cert with the freshly generated one
    cp "${CERT_SRC}" "${CERT_DST}"
    chmod 644 "${CERT_DST}"
    ok "New key+cert installed."
fi

# ── 4. Install site config ─────────────────────────────────────────────
echo ""
echo "⚙  Installing nginx site config..."

[[ -f "${SITE_SRC}" ]] || die "Site config not found: ${SITE_SRC}"

cp "${SITE_SRC}" "${SITE_DST}"
chmod 644 "${SITE_DST}"
ok "Config → ${SITE_DST}"

# ── 5. Enable site (disable default if present) ────────────────────────
echo ""
echo "🔗 Enabling site..."

ln -sf "${SITE_DST}" "${SITE_LINK}"
ok "Symlink → ${SITE_LINK}"

# Remove nginx default site if it conflicts on port 80/443
if [[ -f /etc/nginx/sites-enabled/default ]]; then
    warn "Removing conflicting /etc/nginx/sites-enabled/default"
    rm -f /etc/nginx/sites-enabled/default
fi

# ── 6. Test and reload ─────────────────────────────────────────────────
echo ""
echo "🧪 Testing nginx configuration..."
nginx -t || die "nginx config test failed. Fix errors above and re-run."
ok "Config test passed."

echo ""
echo "♻  Reloading nginx..."
if systemctl is-active --quiet nginx; then
    systemctl reload nginx
    ok "nginx reloaded."
else
    systemctl start nginx
    ok "nginx started."
fi

# ── Done ───────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo -e "${GREEN}  ✅  iMentor nginx deployment complete!${NC}"
echo ""
echo "  Active config : ${SITE_DST}"
echo "  Certificate   : ${CERT_DST}"
echo "  Private key   : ${KEY_DST}"
echo ""
echo "  Serving on    : https://61.0.228.124"
echo "                  https://172.180.14.125"
echo "                  https://localhost"
echo ""
echo "  Test endpoint : https://61.0.228.124/testaddr"
echo "═══════════════════════════════════════════════════════"
echo ""
