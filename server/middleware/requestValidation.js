// server/middleware/requestValidation.js
// ─────────────────────────────────────────────────────────────────────────────
// Request Validation Middleware — Zod-based input guards for critical endpoints.
// Validates structure, types, and enforces size limits BEFORE business logic.
// ─────────────────────────────────────────────────────────────────────────────
const { z } = require('zod');
const log = require('../utils/logger');

// ─────────────────── Shared helpers ───────────────────
const MAX_CHAT_QUERY_LENGTH = 2000;
const MAX_CODE_LENGTH = 5000;
const MAX_RESEARCH_QUERY_LENGTH = 2000;

/**
 * Builds an Express middleware from a Zod schema.
 * On failure → 400 with { success: false, error: "Invalid request parameters" }
 * On success → attaches `req.validatedBody` and calls next().
 */
function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const details = result.error.issues.map(
                (i) => `${i.path.join('.') || 'body'}: ${i.message}`
            );
            log.warn('VALIDATION', `Request rejected [${req.method} ${req.originalUrl}]: ${details.join('; ')}`);
            return res.status(400).json({
                success: false,
                error: 'Invalid request parameters',
                details  // helpful for debugging; remove in hard-prod if desired
            });
        }
        req.validatedBody = result.data;
        next();
    };
}

// ─────────────────── Schemas ───────────────────

// 1. Chat message  — POST /api/chat/message
const chatMessageSchema = z.object({
    query: z
        .string({ required_error: 'query is required' })
        .min(1, 'query must not be empty')
        .max(MAX_CHAT_QUERY_LENGTH, `query must be at most ${MAX_CHAT_QUERY_LENGTH} characters`),
    sessionId: z
        .string({ required_error: 'sessionId is required' })
        .min(1, 'sessionId must not be empty')
        .max(200, 'sessionId is too long'),
    // Optional fields — validated when present
    useWebSearch: z.boolean().nullish(),
    useAcademicSearch: z.boolean().nullish(),
    criticalThinkingEnabled: z.boolean().nullish(),
    deepResearchMode: z.boolean().nullish(),
    useReAct: z.boolean().nullish(),
    tutorMode: z.boolean().nullish(),
    isTutorMode: z.boolean().nullish(),
    tutor_mode: z.boolean().nullish(),
    tutorModeType: z.string().max(50).nullish(),
    currentModulePathId: z.string().max(500).nullish(),
    documentContextName: z.string().max(500).nullish(),
    filter: z.string().max(200).nullish(),
    systemPrompt: z.string().max(10000).nullish(),
    bountyId: z.string().max(200).nullish(),
    bountyAnswer: z.string().max(2000).nullish(),
    // Allow unknown fields to pass through (important: don't break existing logic)
}).passthrough();

// 2. Code execution  — POST /api/tools/execute
const codeExecutionSchema = z.object({
    language: z
        .string({ required_error: 'language is required' })
        .min(1, 'language must not be empty')
        .max(50, 'language name too long'),
    code: z
        .string({ required_error: 'code is required' })
        .min(1, 'code must not be empty')
        .max(MAX_CODE_LENGTH, `code must be at most ${MAX_CODE_LENGTH} characters`),
    testCases: z.array(z.any()).max(20, 'too many test cases').optional(),
}).passthrough();

// 3. Code analysis  — POST /api/tools/analyze-code
const codeAnalysisSchema = z.object({
    language: z
        .string({ required_error: 'language is required' })
        .min(1, 'language must not be empty')
        .max(50, 'language name too long'),
    code: z
        .string({ required_error: 'code is required' })
        .min(1, 'code must not be empty')
        .max(MAX_CODE_LENGTH, `code must be at most ${MAX_CODE_LENGTH} characters`),
}).passthrough();

// 4. Test case generation  — POST /api/tools/generate-test-cases
const testCaseGenSchema = z.object({
    language: z
        .string({ required_error: 'language is required' })
        .min(1, 'language must not be empty')
        .max(50, 'language name too long'),
    code: z
        .string({ required_error: 'code is required' })
        .min(1, 'code must not be empty')
        .max(MAX_CODE_LENGTH, `code must be at most ${MAX_CODE_LENGTH} characters`),
}).passthrough();

// 5. Error explanation  — POST /api/tools/explain-error
const explainErrorSchema = z.object({
    language: z
        .string({ required_error: 'language is required' })
        .min(1, 'language must not be empty')
        .max(50, 'language name too long'),
    code: z
        .string({ required_error: 'code is required' })
        .min(1, 'code must not be empty')
        .max(MAX_CODE_LENGTH, `code must be at most ${MAX_CODE_LENGTH} characters`),
    errorMessage: z
        .string({ required_error: 'errorMessage is required' })
        .min(1, 'errorMessage must not be empty')
        .max(2000, 'errorMessage is too long'),
}).passthrough();

// 6. Integrity analysis  — POST /api/tools/analyze-integrity/submit
const integritySubmitSchema = z.object({
    text: z
        .string({ required_error: 'text is required' })
        .min(50, 'A minimum of 50 characters of text is required for analysis')
        .max(50000, 'text is too long (max 50,000 characters)'),
}).passthrough();

// 7. File upload metadata  — POST /api/upload
//    (multer handles the binary; we validate the metadata portion)
const fileUploadMetadataSchema = z.object({
    // These are optional metadata fields that can accompany a file upload.
    // The actual file presence is enforced by multer + the route handler.
    courseId: z.string().max(200).optional(),
    title: z.string().max(500).optional(),
    description: z.string().max(2000).optional(),
    sourceType: z.string().max(50).optional(),
}).passthrough();

// 8. Deep research (via chat message — reuse chatMessageSchema for the main path)
//    This is the same as chatMessageSchema but we keep it explicit for clarity.
const deepResearchSchema = chatMessageSchema;

// 9. Research report export — POST /api/research/:id/export
//    No body fields to validate; the :id param is a MongoDB ObjectId.
const researchExportSchema = z.object({}).passthrough();

// ─────────────────── Pre-built middleware exports ───────────────────

module.exports = {
    // Core factory
    validate,

    // Limits (exported for tests / docs)
    MAX_CHAT_QUERY_LENGTH,
    MAX_CODE_LENGTH,
    MAX_RESEARCH_QUERY_LENGTH,

    // Route-specific middleware
    validateChatMessage:        validate(chatMessageSchema),
    validateCodeExecution:      validate(codeExecutionSchema),
    validateCodeAnalysis:       validate(codeAnalysisSchema),
    validateTestCaseGen:        validate(testCaseGenSchema),
    validateExplainError:       validate(explainErrorSchema),
    validateIntegritySubmit:    validate(integritySubmitSchema),
    validateFileUploadMeta:     validate(fileUploadMetadataSchema),
    validateResearchExport:     validate(researchExportSchema),

    // Schemas (exported for advanced / composite reuse)
    schemas: {
        chatMessageSchema,
        codeExecutionSchema,
        codeAnalysisSchema,
        testCaseGenSchema,
        explainErrorSchema,
        integritySubmitSchema,
        fileUploadMetadataSchema,
        deepResearchSchema,
        researchExportSchema,
    }
};
