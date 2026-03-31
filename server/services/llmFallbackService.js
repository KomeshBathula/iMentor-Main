// server/services/llmFallbackService.js
/**
 * Universal LLM Fallback Service
 * 
 * Guarantees a response regardless of provider availability:
 *   1. Respects user preference (local-first or cloud-first)
 *   2. If preferred provider fails → tries full chain automatically
 *   3. Local-first:  ollama → groq → gemini → anthropic → mistral
 *   4. Cloud-first:  user-preferred-cloud → groq → gemini → ollama → anthropic → mistral
 *   5. Works for chat, Socratic, tools, research — every call site
 *   6. Supports thinking models (qwen3, gemma3, deepseek-r1) with native think flag
 *
 * Usage:
 *   const { callWithFallback, streamWithFallback } = require('./llmFallbackService');
 *   const result = await callWithFallback({ messages, systemPrompt, options, onToken });
 */

const log = require('../utils/logger');
const { checkOllamaHealth } = require('./ollamaHealthService');

// Lazy-load provider services to avoid circular deps
let _gemini, _ollama, _streaming;
function geminiService()    { return _gemini    || (_gemini    = require('./geminiService'));    }
function ollamaService()    { return _ollama    || (_ollama    = require('./ollamaService'));    }
function streamingService() { return _streaming || (_streaming = require('./llmStreamingService')); }

// ─── THINKING MODEL DETECTION ──────────────────────────────────────────────
const THINKING_MODEL_PATTERNS = /qwen3|qwq|deepseek.*r1|gemma3|gemma-3/i;

function isThinkingModel(modelId) {
    return THINKING_MODEL_PATTERNS.test(modelId || '');
}

/**
 * Strip <thinking>…</thinking> blocks from final output for clean user-facing text.
 * Returns { thinking, content }.
 */
function separateThinking(text) {
    if (!text || typeof text !== 'string') return { thinking: null, content: text || '' };
    const match = text.match(/<thinking>([\s\S]*?)<\/thinking>/i);
    if (!match) return { thinking: text.thinking || null, content: String(text) };
    return {
        thinking: match[1].trim(),
        content: text.replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, '').trim(),
    };
}

// ─── PROVIDER AVAILABILITY CACHE (avoids repeated health checks) ───────────
let _ollamaHealthy = null;
let _ollamaHealthTs = 0;
let _ollamaUrl = null;
const HEALTH_CACHE_MS = 600_000; // 10 minutes (Ollama is local, no need to re-probe every 30s)

async function isOllamaUp(userOllamaUrl) {
    const now = Date.now();
    if (_ollamaHealthy !== null && (now - _ollamaHealthTs) < HEALTH_CACHE_MS) {
        return { healthy: _ollamaHealthy, url: _ollamaUrl };
    }
    const candidates = [
        userOllamaUrl,
        process.env.OLLAMA_API_BASE_URL,
        `http://localhost:${process.env.OLLAMA_PORT || 11434}`
    ].filter(Boolean);

    for (const url of candidates) {
        try {
            const ok = await checkOllamaHealth(url.trim());
            if (ok) {
                _ollamaHealthy = true;
                _ollamaHealthTs = now;
                _ollamaUrl = url.trim();
                return { healthy: true, url: _ollamaUrl };
            }
        } catch { /* continue */ }
    }
    _ollamaHealthy = false;
    _ollamaHealthTs = now;
    _ollamaUrl = null;
    return { healthy: false, url: null };
}

/**
 * Invalidate health cache when a call fails at runtime.
 */
function invalidateOllamaHealth() {
    _ollamaHealthy = null;
    _ollamaHealthTs = 0;
}

// ─── API KEY AVAILABILITY ──────────────────────────────────────────────────
function hasApiKey(provider, userKeys = {}) {
    switch (provider) {
        case 'gemini': return Boolean(userKeys.gemini || process.env.GEMINI_API_KEY);
        case 'ollama': return true; // no key needed
        default:       return false;
    }
}

function getApiKey(provider, userKeys = {}) {
    switch (provider) {
        case 'gemini': return userKeys.gemini || process.env.GEMINI_API_KEY;
        default:       return null;
    }
}

// ─── FALLBACK CHAIN BUILDER ────────────────────────────────────────────────
// Ollama is REMOVED from LLM chains — it is for embeddings only (now replaced by FastEmbed).
// SGLang is handled via callFast/getFastModel. Cloud fallback = Gemini (admin-validated only).
const LOCAL_FIRST_CHAIN  = ['sglang', 'gemini'];
const CLOUD_FIRST_CHAIN  = ['gemini', 'sglang'];

/**
 * Build an ordered provider chain with user preference first.
 */
function buildFallbackChain(preferredProvider = 'sglang', preferLocalFirst = true) {
    const base = preferLocalFirst ? [...LOCAL_FIRST_CHAIN] : [...CLOUD_FIRST_CHAIN];
    const norm = (preferredProvider || 'sglang').toLowerCase().trim();
    // Put preferred first, then the rest in default order
    const chain = [norm, ...base.filter(p => p !== norm)];
    return chain;
}

// ─── PROVIDER SERVICE MAP ──────────────────────────────────────────────────
function getServiceForProvider(provider) {
    switch (provider) {
        case 'gemini': return geminiService();
        case 'ollama': return ollamaService();
        default:       return null;
    }
}

// Providers that support streaming in llmStreamingService
const UNIFIED_STREAM_PROVIDERS = new Set(['gemini']);

// ─── CORE: CALL WITH FALLBACK ──────────────────────────────────────────────
/**
 * Make an LLM call with automatic fallback through the provider chain.
 *
 * @param {Object} params
 * @param {Array}  params.chatHistory  - Conversation history
 * @param {string} params.userQuery    - Current user message
 * @param {string} params.systemPrompt - System instruction
 * @param {Object} params.options      - { model, temperature, maxOutputTokens, ... }
 * @param {string} params.preferredProvider - 'ollama'|'gemini'|'groq'|'anthropic'|'mistral'
 * @param {boolean} params.preferLocalFirst - Whether to prefer local providers
 * @param {Object} params.userApiKeys  - { gemini, groq, anthropic, mistral }
 * @param {string} params.ollamaUrl    - User-specific Ollama URL
 * @param {Function} params.onToken    - Streaming callback (optional)
 * @returns {Promise<{text: string, provider: string, model: string, thinking: string|null, wasFailover: boolean}>}
 */
async function callWithFallback({
    chatHistory = [],
    userQuery,
    systemPrompt = null,
    options = {},
    preferredProvider = 'ollama',
    preferLocalFirst = true,
    userApiKeys = {},
    ollamaUrl = null,
    onToken = null,
}) {
    const chain = buildFallbackChain(preferredProvider, preferLocalFirst);
    const errors = [];

    for (const provider of chain) {
        // Skip providers without API keys (except ollama)
        if (provider !== 'ollama' && !hasApiKey(provider, userApiKeys)) {
            continue;
        }

        // For Ollama, check health first
        if (provider === 'ollama') {
            const { healthy, url } = await isOllamaUp(ollamaUrl);
            if (!healthy) {
                log.warn('AI', `[Fallback] Skipping ollama — not reachable`);
                continue;
            }
            ollamaUrl = url;
        }

        const apiKey = getApiKey(provider, userApiKeys);
        const model = resolveModelForProvider(provider, options);
        const thinkEnabled = isThinkingModel(model);

        const callOptions = {
            ...options,
            apiKey,
            model,
            ollamaUrl,
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens ?? 4096,
            ...(provider === 'gemini' && { geminiModel: model }),
            ...(thinkEnabled && { think: true }),
        };

        try {
            let result;

            if (onToken && provider === 'ollama') {
                // Ollama has native streaming via streamChat
                result = await ollamaService().streamChat(
                    chatHistory, userQuery, systemPrompt, callOptions,
                    (token) => {
                        if (typeof token === 'string') {
                            onToken({ type: 'token', content: token });
                        } else {
                            onToken(token);
                        }
                    }
                );
            } else if (onToken && UNIFIED_STREAM_PROVIDERS.has(provider)) {
                // Gemini via unified streaming service
                const messages = [
                    ...chatHistory.map(m => ({
                        role: m.role === 'model' ? 'assistant' : m.role,
                        content: Array.isArray(m.parts) ? m.parts[0].text : (m.text || m.content || '')
                    })),
                    { role: 'user', content: userQuery }
                ];
                result = await streamingService().streamCompletion({
                    messages, provider, model, apiKey, systemPrompt, onToken,
                    options: { ...callOptions, handleThinkingTags: thinkEnabled }
                });
            } else {
                // Non-streaming path
                const svc = getServiceForProvider(provider);
                result = await svc.generateContentWithHistory(chatHistory, userQuery, systemPrompt, callOptions);
            }

            const text = typeof result === 'string' ? result : String(result || '');
            const { thinking, content } = separateThinking(text);

            log.info('AI', `[Fallback] ✓ ${provider}/${model} succeeded (${content.length} chars)`);

            return {
                text: content,
                thinking: thinking || result?.thinking || null,
                provider,
                model,
                wasFailover: provider !== preferredProvider,
                apiKey,
                ollamaUrl,
            };
        } catch (err) {
            const msg = err.message || String(err);
            errors.push({ provider, model, error: msg });
            log.warn('AI', `[Fallback] ✗ ${provider} failed: ${msg.slice(0, 120)}`);
            if (provider === 'ollama') invalidateOllamaHealth();
        }
    }

    // All providers failed — return a graceful error
    log.error('AI', `[Fallback] ALL providers exhausted`, errors);
    return {
        text: 'I\'m currently unable to process your request — all AI providers are unavailable. Please check your API keys or ensure your local Ollama server is running, then try again.',
        thinking: null,
        provider: 'none',
        model: 'none',
        wasFailover: true,
        errors,
    };
}

// ─── MODEL RESOLUTION ──────────────────────────────────────────────────────
function resolveModelForProvider(provider, options = {}) {
    if (options.geminiModel && provider === 'gemini') return options.geminiModel;
    switch (provider) {
        case 'ollama':  return options.model || process.env.OLLAMA_DEFAULT_MODEL || 'qwen3.5:9b';
        case 'gemini':  return options.geminiModel || options.model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
        default:        return options.model || 'gemini-2.0-flash';
    }
}

// ─── FAST MODEL SELECTOR (for overhead calls) ──────────────────────────────
/**
 * Returns the fastest available provider+model for low-latency overhead calls.
 * Priority: SGLang (primary, local GPU) → Gemini (admin-validated only).
 * Ollama is NEVER used for LLM generation tasks — embeddings only.
 */
async function getFastModel(userApiKeys = {}, ollamaUrlHint = null) {
    // 1) SGLang — primary for all LLM generation calls
    if (process.env.SGLANG_ENABLED === 'true') {
        return {
            provider: 'sglang',
            model: process.env.SGLANG_CHAT_MODEL || 'Qwen/Qwen2.5-7B-Instruct-AWQ',
            sglangUrl: process.env.SGLANG_CHAT_URL || 'http://localhost:8000/v1',
        };
    }

    // 2) Gemini — ONLY if admin has explicitly validated the key
    if (process.env.GEMINI_API_VALIDATED === 'true' && hasApiKey('gemini', userApiKeys)) {
        return {
            provider: 'gemini',
            model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
            apiKey: getApiKey('gemini', userApiKeys),
        };
    }

    return null; // nothing available
}

/**
 * Quick non-streaming LLM call using the fastest available model.
 * Ideal for decomposition, classification, critique — overhead calls.
 */
async function callFast({ prompt, systemPrompt = null, userApiKeys = {}, ollamaUrl = null, options = {} }) {
    const fast = await getFastModel(userApiKeys, ollamaUrl);
    if (!fast) {
        throw new Error('No LLM provider available for fast call');
    }

    // SGLang uses OpenAI-compatible REST — call directly via axios
    if (fast.provider === 'sglang') {
        const axios = require('axios');
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });
        const resp = await axios.post(`${fast.sglangUrl}/chat/completions`, {
            model: fast.model,
            messages,
            max_tokens: options.maxOutputTokens ?? 2048,
            temperature: options.temperature ?? 0.3,
            stream: false,
        }, { timeout: 30000 });
        const text = resp.data?.choices?.[0]?.message?.content?.trim() || '';
        if (!text) throw new Error('SGLang fast call returned empty response');
        return text;
    }

    const svc = getServiceForProvider(fast.provider);
    const callOpts = {
        ...options,
        apiKey: fast.apiKey,
        model: fast.model,
        ollamaUrl: fast.ollamaUrl,
        temperature: options.temperature ?? 0.3, // low temp for structural calls
        maxOutputTokens: options.maxOutputTokens ?? 2048,
        think: false, // overhead calls must NEVER trigger thinking — saves 15-40s per call
        ...(fast.provider === 'gemini' && { geminiModel: fast.model }),
    };

    return svc.generateContentWithHistory([], prompt, systemPrompt, callOpts);
}

module.exports = {
    callWithFallback,
    callFast,
    getFastModel,
    buildFallbackChain,
    isThinkingModel,
    separateThinking,
    hasApiKey,
    getApiKey,
    isOllamaUp,
    invalidateOllamaHealth,
    resolveModelForProvider,
};
