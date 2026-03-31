# iMentor Routing Architecture - PERSISTENT RULES

**Last Updated:** March 23, 2026  
**Critical Configuration:** This document defines the IMMUTABLE routing rules to prevent configuration drift.

---

## 🚨 CRITICAL RULES (DO NOT VIOLATE)

### Rule 1: Ollama is ONLY for Embeddings + Semantic Router
```
✅ ALLOWED:
- mxbai-embed-large (1024-dim embeddings for RAG + semantic search)
- qwen2.5:3b (semantic router FALLBACK - table-based decisions only)

❌ FORBIDDEN:
- Ollama for chat (qwen3.5:9b, qwen2.5:7b, any chat model)
- Ollama for tutor mode (ai-tutor-custom:latest)
- Ollama for general LLM calls
```

### Rule 2: All Chat Uses SGLang
```
✅ PRIMARY:
- sglang_chat (Qwen2.5-7B-Instruct-AWQ) → standard chat, direct_answer, web_search
- sglang_reason (Qwen2.5-7B-Instruct-AWQ) → ToT (when Thinking icon active)
- sglang_tutor (Qwen2.5-7B-Instruct-AWQ) → Socratic tutor mode
- sglang_heavy (Qwen2.5-7B-Instruct-AWQ) → STN generation, night jobs

🔄 FALLBACK (only when SGLang unreachable):
- gemini-2.0-flash → Gemini API fallback
```

### Rule 3: Semantic Router is TABLE-BASED, Not LLM-Based
```
Decision Flow:
1. SESSION FLAGS checked FIRST (step 0):
   - tutorMode=true → TUTOR route (bypasses semantic routing)
   - quizMode=true → QUIZ route (bypasses semantic routing)
   - useReAct=true → REACT route (bypasses semantic routing)
   - criticalThinkingEnabled=true → allows ToT (but still needs semantic match)

2. For non-flagged sessions:
   a. Embedding (mxbai-embed-large via Ollama) → ~5ms
   b. Cosine similarity vs prototype table → ~1ms
   c. Confidence check:
      - ✅ confidence > 0.75 + Thinking icon → ToT route
      - ✅ confidence > 0.70 → web_search route
      - ✅ confidence > 0.65 → standard route
      - ⚠️  confidence < 0.65 → fallback to keyword classifier
      - 🆘 keyword < 0.65 → last resort: qwen2.5:3b LLM call

The qwen2.5:3b is a LAST RESORT, expected <5% of queries.
```

### Rule 4: ToT Route Requirements
```
ToT (Tree of Thoughts) ONLY activates when:
1. ✅ Thinking icon is clicked in UI (criticalThinkingEnabled=true)
2. ✅ Semantic confidence > 0.75 for ToT prototypes
3. ✅ Complexity score > 85

All three conditions MUST be met. Without Thinking icon activation,
complex queries route to standard (not ToT).
```

### Rule 5: Tutor Mode Bypasses Semantic Routing
```
When tutorMode=true:
- Session flag checked at step 0 (BEFORE semantic routing)
- Directly routes to TUTOR orchestrator
- No embedding computation
- No semantic table lookup
- This is by design for consistent Socratic experience
```

---

## 📁 Configuration Files (Keep in Sync)

### 1. `.env` (Primary Source of Truth)
```bash
# Ollama: EMBEDDINGS + ROUTER ONLY
OLLAMA_EMBED_MODEL=mxbai-embed-large
OLLAMA_ROUTER_MODEL=qwen2.5:3b
OLLAMA_DEFAULT_MODEL=               # MUST BE EMPTY!
OLLAMA_FAST_MODEL=                  # MUST BE EMPTY!
OLLAMA_STN_MODEL=                   # MUST BE EMPTY!

# SGLang: ALL CHAT OPERATIONS
SGLANG_ENABLED=true
SGLANG_CHAT_URL=http://localhost:8000/v1
SGLANG_CHAT_MODEL=Qwen/Qwen2.5-7B-Instruct-AWQ

# Embeddings Provider
EMBED_PROVIDER=ollama
```

### 2. `server/config/routingConfig.js`
```javascript
const PROVIDERS = {
    OLLAMA_EMBED:    { embeddingOnly: true },  // mxbai-embed-large
    OLLAMA_ROUTER:   { routerOnly: true },     // qwen2.5:3b
    SGLANG_CHAT:     { active: true },         // Primary chat
    SGLANG_TUTOR:    { active: true },         // Tutor mode
    SGLANG_HEAVY:    { active: true },         // STN/night jobs
    GEMINI_FLASH:    { active: !!process.env.GEMINI_API_KEY }, // Fallback
};
```

### 3. `server/scripts/initializeLLMCatalog.js`
```javascript
OLLAMA_MODELS = [
  { modelId: 'ollama/qwen2.5:3b', routerOnly: true },
  { modelId: 'ollama/mxbai-embed-large', embeddingOnly: true }
];
SGLANG_MODELS = [
  { modelId: 'sglang/qwen2.5-7b-instruct-awq', isDefault: true },
  // ... other SGLang models
];
```

---

## 🔍 How to Verify Configuration

### Quick Check
```bash
# 1. Verify .env
grep -E "OLLAMA_DEFAULT_MODEL|OLLAMA_ROUTER_MODEL|SGLANG_ENABLED" server/.env

# Expected output:
# OLLAMA_DEFAULT_MODEL=
# OLLAMA_ROUTER_MODEL=qwen2.5:3b
# SGLANG_ENABLED=true

# 2. Check LLM Catalog
node server/scripts/initializeLLMCatalog.js
# Should show: 3 SGLang + 2 Ollama (embeddings/router) + 2 Gemini = 7 models

# 3. Test semantic router
curl -X POST http://localhost:2001/embed -H "Content-Type: application/json" \
  -d '{"text":"Hello world"}'
# Should return 1024-dim vector from mxbai-embed-large
```

### Runtime Verification
```bash
# Monitor logs for incorrect Ollama usage
tail -f server/logs/server.log | grep -E "ollama.*chat|qwen3.5:9b"
# Should be EMPTY! If you see these, Ollama is being misused for chat.

# Check SGLang usage
tail -f server/logs/server.log | grep -E "sglang_chat|SGLANG_CHAT_URL"
# Should see SGLang being used for chat operations
```

---

## 🐛 Common Bugs & Fixes

### Bug: "Ollama is being used for chat"
**Symptoms:**
- Logs show `ollama / qwen3.5:9b` for chat queries
- Server uses `OLLAMA_DEFAULT_MODEL` for responses

**Fix:**
```bash
# 1. Empty the Ollama chat models in .env
sed -i 's/^OLLAMA_DEFAULT_MODEL=.*/OLLAMA_DEFAULT_MODEL=/' server/.env
sed -i 's/^OLLAMA_FAST_MODEL=.*/OLLAMA_FAST_MODEL=/' server/.env

# 2. Verify SGLang is enabled
grep "SGLANG_ENABLED=true" server/.env || echo "SGLANG_ENABLED=true" >> server/.env

# 3. Reinitialize LLM catalog
node server/scripts/initializeLLMCatalog.js

# 4. Restart server
./start_all.sh all
```

### Bug: "LLM router being called too often"
**Symptoms:**
- Logs show frequent `llm_2b_router` calls
- High latency (~500ms per query)

**Fix:**
```bash
# Expand the prototype table in server/data/routing_prototypes.json
# Add more example queries for direct_answer, standard, tutor routes
# Goal: >95% of queries should hit semantic or keyword confidence thresholds
```

### Bug: "Semantic router unavailable"
**Symptoms:**
- Logs show `semantic_unavailable` method
- All queries fall back to keyword/LLM routing

**Fix:**
```bash
# 1. Check Python RAG service is running
docker ps | grep imentor-rag

# 2. Test embedding endpoint
curl http://localhost:2001/embed -d '{"text":"test"}' -H "Content-Type: application/json"

# 3. Verify Ollama has mxbai-embed-large pulled
docker exec ollama ollama list | grep mxbai-embed-large
# If missing: docker exec ollama ollama pull mxbai-embed-large
```

---

## 📊 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Semantic router cache hit rate | >80% | Monitor via Prometheus |
| Table-based routing confidence | >0.65 for 95%+ queries | Check routerCacheCounter |
| LLM router fallback rate | <5% of total queries | Should be rare |
| Embedding latency | <10ms (P95) | Python /embed endpoint |
| Total routing overhead | <15ms (P95) | Semantic + cache lookup |

---

## 🔄 Migration Notes (Historical Context)

**Previous Architecture (Jan 2026):**
- VLLM for inference → Migrated to SGLang (March 2026)
- Ollama for chat → Removed (March 23, 2026)
- LLM-based routing (groq) → Replaced with semantic table (March 2026)

**Why These Changes:**
1. **SGLang:** 2x faster inference than VLLM, better batching
2. **Ollama embeddings only:** CPU-efficient, keeps GPU for SGLang
3. **Table-based routing:** 100-500ms → 5-10ms latency reduction

---

## ✅ Checklist for Configuration Changes

Before modifying routing:
- [ ] Read this document
- [ ] Update `.env` with new values
- [ ] Update `routingConfig.js` PROVIDERS
- [ ] Update `initializeLLMCatalog.js` model definitions
- [ ] Run `node server/scripts/initializeLLMCatalog.js`
- [ ] Restart services with `./start_all.sh all`
- [ ] Monitor logs for 5 minutes to verify correct routing
- [ ] Update this document with any new rules

---

## 📞 Emergency Contacts

If routing is broken in production:
1. Check `monitor.sh` output for service health
2. Verify Docker containers: `docker ps`
3. Check SGLang health: `curl http://localhost:8000/health`
4. Fallback to Gemini: Set `SGLANG_ENABLED=false` in `.env`
5. Review logs: `tail -100 server/logs/server.log`

**Last resort:** Revert to known-good commit and restart all services.
