# iMentor — Nginx Configuration Folder

Everything needed to serve iMentor with nginx lives here.
After a fresh OS install, one command restores the full setup.

---

## Folder structure

```
nginx/
├── nginx.conf                        ← CANONICAL proxy config (source of truth)
├── deploy.sh                         ← One-shot restore script
├── sites-available/
│   ├── 000-unified                   ← Active config deployed to /etc/nginx/sites-available/
│   ├── imentor                       ← Legacy HTTP-only reference (not active)
│   └── interactive-learning          ← Legacy standalone tool reference (not active)
└── certs/
    ├── interactive-learning.crt      ← SSL certificate (safe to version-control)
    ├── interactive-learning.key      ← ⚠ PRIVATE KEY — NOT committed; see KEY_README.md
    ├── KEY_README.md                 ← Instructions to restore or regenerate the key
    └── gen-selfsigned.sh             ← Script to generate a fresh self-signed cert+key
```

---

## Quick restore after a format

```bash
# 1. Clone / copy the project
git clone <repo-url>
cd chatbot

# 2. Place the private key (from backup)
cp /path/to/backup/interactive-learning.key nginx/certs/interactive-learning.key

# 3. Run the deploy script (as root)
sudo bash nginx/deploy.sh
```

That's it. The script will:
- Install nginx if missing
- Copy the cert and key to `/etc/ssl/`
- Copy the site config to `/etc/nginx/sites-available/`
- Create the symlink in `sites-enabled/`
- Run `nginx -t` and reload the service

If you don't have the private key backup, the script will auto-generate a new
self-signed pair. See [certs/KEY_README.md](certs/KEY_README.md) for details.

---

## Service ports (must match `startup.sh`)

| Service              | Port  | Upstream name          |
|----------------------|-------|------------------------|
| React/Vite frontend  | 3005  | `imentor_frontend`     |
| Node.js API          | 5005  | `imentor_backend`      |
| Python RAG (FastAPI) | 2005  | `imentor_rag`          |
| Interactive Learning | 9845  | `interactive_learning` |

---

## Nginx routing map

| Path                    | Proxied to          | Notes                        |
|-------------------------|---------------------|------------------------------|
| `/api/`                 | `imentor_backend`   | SSE + WebSocket, 600s timeout|
| `/rag/`                 | `imentor_rag`       | SSE, 600s timeout            |
| `/socket.io/`           | `imentor_backend`   | WebSocket, 24h timeout       |
| `/metrics`              | `imentor_backend`   | Prometheus metrics           |
| `/interactive-learning/`| `interactive_learning` | Legacy ML tool            |
| `/testaddr`             | (inline)            | Health check                 |
| `/`                     | `imentor_frontend`  | Catch-all; Vite HMR          |

---

## SSL certificate

| Field        | Value                              |
|--------------|------------------------------------|
| Issuer / CN  | 172.180.14.125 (self-signed)       |
| SANs         | `172.180.14.125`, `61.0.228.124`, `localhost` |
| Valid from   | 2026-04-03                         |
| Valid until  | 2028-07-06                         |
| System paths | cert → `/etc/ssl/certs/interactive-learning.crt` |
|              | key  → `/etc/ssl/private/interactive-learning.key` |

---

## Manual nginx commands (reference)

```bash
# Test config
sudo nginx -t

# Reload config (zero-downtime)
sudo systemctl reload nginx

# Full restart
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx

# View live access log
sudo tail -f /var/log/nginx/imentor_access.log

# View live error log
sudo tail -f /var/log/nginx/imentor_error.log
```

---

## Updating the config

1. Edit `nginx/nginx.conf` (the canonical source).
2. Sync it to `nginx/sites-available/000-unified` (they should stay identical).
3. Deploy:
   ```bash
   sudo cp nginx/sites-available/000-unified /etc/nginx/sites-available/000-unified
   sudo nginx -t && sudo systemctl reload nginx
   ```
