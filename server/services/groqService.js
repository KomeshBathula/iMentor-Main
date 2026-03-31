const log = require('../utils/logger');
// server/services/groqService.js
const Groq = require('groq-sdk');

const SERVER_API_KEY = process.env.GROQ_API_KEY;
const DEFAULT_MODEL_NAME = "llama-3.1-8b-instant";

let cachedGroqClient = null;
let cachedApiKey = null;

function getGroqClient(apiKey) {
    if (cachedGroqClient && cachedApiKey === apiKey) {
        return cachedGroqClient;
    }
    cachedGroqClient = new Groq({ apiKey });
    cachedApiKey = apiKey;
    return cachedGroqClient;
}

/**
 * Generate chat completion with history using Groq.
 * @param {Array} chatHistory - Previous messages
 * @param {string} currentUserQuery - Current message
 * @param {string} systemPromptText - Optional system prompt
 * @param {object} options - Options including model, maxOutputTokens, apiKey
 * @returns {Promise<string>} Generated response
 */
async function generateContentWithHistory(
    chatHistory,
    currentUserQuery,
    systemPromptText = null,
    options = {}
) {
    const apiKeyToUse = options.apiKey || SERVER_API_KEY;
    const modelToUse = options.model || DEFAULT_MODEL_NAME;

    if (!apiKeyToUse || apiKeyToUse === "your_groq_api_key_here") {
        log.error('AI', "Groq API key is not configured.");
        throw new Error("Groq API key is missing. Please configure it in your environment variables.");
    }

    try {
        const groq = getGroqClient(apiKeyToUse);

        const messages = [];

        // Build messages array
        if (systemPromptText) {
            messages.push({ role: 'system', content: systemPromptText });
        }

        // Add history
        if (chatHistory && Array.isArray(chatHistory)) {
            chatHistory.forEach(msg => {
                // Adapt roles if necessary (Groq uses 'user', 'assistant', 'system')
                const role = msg.role === 'model' ? 'assistant' : msg.role;
                const content = Array.isArray(msg.parts) ? msg.parts[0].text : (msg.text || msg.content);
                if (role && content) {
                    messages.push({ role, content });
                }
            });
        }

        // Add current query
        messages.push({ role: 'user', content: currentUserQuery });

        const completion = await groq.chat.completions.create({
            messages: messages,
            model: modelToUse,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxOutputTokens || 4096,
            top_p: 1,
            stream: false,
            stop: null
        });

        // log.success('AI', `Groq response: ${completion.choices[0]?.message?.content?.length || 0} chars`);
        return completion.choices[0]?.message?.content || "";
    } catch (error) {
        const status = error.status || error.response?.status || 500;
        const msg = error.message?.toLowerCase() || '';
        const reason =
            (status === 401 || msg.includes('invalid api key') || msg.includes('unauthorized')) ? 'API key is invalid or unauthorized' :
                (status === 429 || msg.includes('rate limit') || msg.includes('quota')) ? 'API quota exceeded or rate limit reached' :
                    (status === 403) ? 'Access denied — API key lacks permissions' :
                        (status === 503 || msg.includes('overloaded')) ? 'Service temporarily overloaded' :
                            'Unexpected error';
        log.warn('AI', `Groq failure: ${reason}`);
        throw new Error(`Groq API failure: ${error.message}`);
    }
}

/**
 * Generate single text completion using Groq.
 * @param {string} prompt - The prompt to send
 * @param {object} config - Configuration including model, apiKey
 * @returns {Promise<string>} Generated text
 */
async function generateText(prompt, config = {}) {
    return generateContentWithHistory([], prompt, null, config);
}

module.exports = {
    generateContentWithHistory,
    generateText
};
