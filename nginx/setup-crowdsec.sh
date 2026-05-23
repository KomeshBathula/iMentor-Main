#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# setup-crowdsec.sh  —  Install CrowdSec + firewall bouncer
# ═══════════════════════════════════════════════════════════════════════
# CrowdSec is a free, open-source security engine:
#   - Analyses nginx/caddy logs for attack patterns
#   - Blocks brute-force, scanners, credential stuffing, DDoS
#   - Uses crowd-sourced threat intelligence (millions of known-bad IPs)
#   - Proxy-agnostic: the firewall bouncer uses iptables/nftables directly
#
# Run as root:  sudo bash nginx/setup-crowdsec.sh
# ═══════════════════════════════════════════════════════════════════════

set -e
[[ $EUID -ne 0 ]] && { echo "Run as root: sudo bash nginx/setup-crowdsec.sh"; exit 1; }

GREEN="\033[0;32m"; YELLOW="\033[1;33m"; NC="\033[0m"
ok()   { echo -e "${GREEN}✅  $*${NC}"; }
info() { echo -e "${YELLOW}ℹ   $*${NC}"; }

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  iMentor — CrowdSec Security Engine Setup"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. Install CrowdSec ────────────────────────────────────────────────
echo "📦 Installing CrowdSec..."
curl -s https://install.crowdsec.net | bash
apt-get install -y crowdsec
ok "CrowdSec installed."

# ── 2. Install firewall bouncer (iptables/nftables) ───────────────────
# The firewall bouncer is proxy-agnostic — works with nginx, caddy, etc.
echo ""
echo "📦 Installing CrowdSec firewall bouncer..."
apt-get install -y crowdsec-firewall-bouncer-iptables
ok "Firewall bouncer installed."

# ── 3. Install security collections ───────────────────────────────────
echo ""
echo "📚 Installing security collections..."

# Core collections
cscli collections install crowdsecurity/linux             # SSH brute force
cscli collections install crowdsecurity/nginx             # nginx attack patterns
cscli collections install crowdsecurity/http-cve          # known CVEs
cscli collections install crowdsecurity/base-http-scenarios  # generic HTTP attacks
cscli collections install crowdsecurity/sshd              # SSH hardening
cscli collections install crowdsecurity/linux-lpe          # Linux privilege escalation

# Web application specific
cscli collections install crowdsecurity/web-attacks       # SQLi, XSS, path traversal
cscli collections install crowdsecurity/appsec-virtual-patching  # OWASP virtual patches

ok "Collections installed."

# ── 4. Configure nginx log parser ─────────────────────────────────────
echo ""
echo "⚙  Configuring log acquisition for nginx..."

cat > /etc/crowdsec/acquis.d/imentor-nginx.yaml << 'EOF'
# iMentor nginx log acquisition
---
filenames:
  - /var/log/nginx/imentor_access.log
  - /var/log/nginx/imentor_error.log
  - /var/log/nginx/access.log
  - /var/log/nginx/error.log
labels:
  type: nginx
---
filenames:
  - /var/log/auth.log
labels:
  type: syslog
EOF

ok "Log acquisition configured."

# ── 5. Configure rate-limiting decisions ──────────────────────────────
echo ""
echo "⚙  Configuring custom rate-limit profiles..."

cat > /etc/crowdsec/profiles.yaml << 'EOF'
# iMentor CrowdSec profiles
name: default_ip_remediation
filters:
  - Alert.Remediation == true && Alert.GetScope() == "Ip"
decisions:
  - type: ban
    duration: 4h
on_success: break
---
name: aggressive_ban
filters:
  - Alert.Remediation == true && Alert.GetScope() == "Ip" && Alert.GetScenario() contains "http-probing"
decisions:
  - type: ban
    duration: 24h
on_success: break
EOF

ok "Rate-limit profiles configured."

# ── 6. Register with CrowdSec Central API (optional but recommended) ──
echo ""
info "Registering with CrowdSec Central API (provides crowd-sourced threat intel)..."
cscli capi register 2>/dev/null || info "Already registered or offline — skipping."

# ── 7. Update hub ─────────────────────────────────────────────────────
echo ""
echo "🔄 Updating CrowdSec hub..."
cscli hub update

# ── 8. Enable and start services ──────────────────────────────────────
echo ""
echo "🚀 Starting services..."
systemctl enable crowdsec
systemctl restart crowdsec
systemctl enable crowdsec-firewall-bouncer
systemctl restart crowdsec-firewall-bouncer

ok "CrowdSec engine running."
ok "Firewall bouncer running."

# ── 9. Show status ────────────────────────────────────────────────────
echo ""
echo "📊 CrowdSec status:"
cscli machines list
echo ""
echo "📚 Installed collections:"
cscli collections list
echo ""
echo "🚫 Current bans:"
cscli decisions list

echo ""
echo "═══════════════════════════════════════════════════════"
echo -e "${GREEN}  ✅  CrowdSec is now protecting iMentor!${NC}"
echo ""
echo "  Useful commands:"
echo "   cscli decisions list          — show active bans"
echo "   cscli alerts list             — show triggered alerts"
echo "   cscli metrics                 — show engine metrics"
echo "   cscli ban add ip 1.2.3.4 24h  — manually ban an IP"
echo "   cscli ban del ip 1.2.3.4      — remove a ban"
echo ""
echo "  Dashboard (free): https://app.crowdsec.net"
echo "═══════════════════════════════════════════════════════"
echo ""
