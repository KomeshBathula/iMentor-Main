const { checkOllamaHealth } = require('./ollamaHealthService');

const SGLANG_ENABLED = process.env.SGLANG_ENABLED === 'true';

// No fallback chains — user choice is final.
// When SGLANG_ENABLED, local_llm and ollama both map to local inference.
const PROVIDER_FALLBACK_ORDER = SGLANG_ENABLED
    ? ['ollama']
    : ['ollama', 'gemini'];

function normalizeProvider(provider) {
    if (typeof provider !== 'string') return 'ollama';
    const normalized = provider.trim().toLowerCase();
    // 'local_llm' is the UI alias for local inference (SGLang/Ollama)
    if (normalized === 'local_llm') return 'ollama';
    return PROVIDER_FALLBACK_ORDER.includes(normalized) ? normalized : 'ollama';
}

function getProviderChain(preferredProvider) {
    // No fallback — return only the chosen provider
    const preferred = normalizeProvider(preferredProvider);
    return [preferred];
}

function getApiKeyForProvider(provider, preferredProvider, userApiKey) {
    const preferred = normalizeProvider(preferredProvider);
    if (provider === 'gemini') {
        return process.env.GEMINI_API_KEY || (preferred === 'gemini' ? userApiKey : null) || null;
    }
    return null;
}

async function resolveProviderByPreference({
    preferredProvider,
    userApiKey = null,
    userOllamaUrl = null,
    skipOllamaHealthCheck = false,
}) {
    const preferred = normalizeProvider(preferredProvider);

    const ollamaCandidates = [userOllamaUrl, process.env.OLLAMA_API_BASE_URL]
        .filter((url) => typeof url === 'string' && url.trim())
        .map((url) => url.trim().replace(/\/+$/, ''));

    let ollamaAvailable = false;
    let workingOllamaUrl = null;

    if (preferred === 'ollama' && ollamaCandidates.length > 0) {
        if (skipOllamaHealthCheck) {
            ollamaAvailable = true;
            workingOllamaUrl = ollamaCandidates[0];
        } else {
            for (const candidate of ollamaCandidates) {
                if (await checkOllamaHealth(candidate)) {
                    ollamaAvailable = true;
                    workingOllamaUrl = candidate;
                    break;
                }
            }
        }
    }

    // No silent fallback — user gets what they chose or an error
    const availability = {
        ollama: ollamaAvailable,
        gemini: !SGLANG_ENABLED && Boolean(process.env.GEMINI_API_KEY || (preferred === 'gemini' && userApiKey)),
    };

    // Only the preferred provider — no fallback to others
    return {
        chosenProvider: preferred,
        chain: [preferred],
        availability,
        workingOllamaUrl,
        apiKey: getApiKeyForProvider(preferred, preferredProvider, userApiKey),
    };
}

module.exports = {
    PROVIDER_FALLBACK_ORDER,
    normalizeProvider,
    getProviderChain,
    getApiKeyForProvider,
    resolveProviderByPreference,
};
