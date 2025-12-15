/**
 * Centralized error handling for the Spider Scribe extension.
 * Provides typed errors with codes and user-friendly messages.
 */

export const ErrorCode = {
    // API Key Errors
    GEMINI_API_KEY_MISSING: 'GEMINI_API_KEY_MISSING',
    GROK_API_KEY_MISSING: 'GROK_API_KEY_MISSING',
    OPENAI_API_KEY_MISSING: 'OPENAI_API_KEY_MISSING',

    // Network Errors
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',

    // API Response Errors
    API_ERROR: 'API_ERROR',
    RATE_LIMITED: 'RATE_LIMITED',
    INVALID_API_KEY: 'INVALID_API_KEY',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

    // Parse Errors
    JSON_PARSE_ERROR: 'JSON_PARSE_ERROR',
    RESPONSE_MISMATCH: 'RESPONSE_MISMATCH',
    INVALID_RESPONSE: 'INVALID_RESPONSE',

    // Extension Errors
    NO_ACTIVE_TAB: 'NO_ACTIVE_TAB',
    CONTENT_SCRIPT_NOT_LOADED: 'CONTENT_SCRIPT_NOT_LOADED',
    STORAGE_ERROR: 'STORAGE_ERROR',
    MESSAGE_ERROR: 'MESSAGE_ERROR',

    // General
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

/** User-friendly error messages mapped to error codes */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
    [ErrorCode.GEMINI_API_KEY_MISSING]: 'Gemini API key is missing. Please add it in Settings.',
    [ErrorCode.GROK_API_KEY_MISSING]: 'Grok API key is missing. Please add it in Settings.',
    [ErrorCode.OPENAI_API_KEY_MISSING]: 'OpenAI API key is missing. Please add it in Settings.',
    [ErrorCode.NETWORK_ERROR]: 'Network error. Please check your connection.',
    [ErrorCode.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
    [ErrorCode.API_ERROR]: 'API error occurred. Please try again.',
    [ErrorCode.RATE_LIMITED]: 'Rate limited. Please wait a moment before trying again.',
    [ErrorCode.INVALID_API_KEY]: 'Invalid API key. Please check your key in Settings.',
    [ErrorCode.QUOTA_EXCEEDED]: 'API quota exceeded. Please check your usage limits.',
    [ErrorCode.JSON_PARSE_ERROR]: 'Failed to parse AI response. Please try again.',
    [ErrorCode.RESPONSE_MISMATCH]: 'Translation count mismatch. Some texts may not be translated.',
    [ErrorCode.INVALID_RESPONSE]: 'Invalid response from AI. Please try again.',
    [ErrorCode.NO_ACTIVE_TAB]: 'No active tab found.',
    [ErrorCode.CONTENT_SCRIPT_NOT_LOADED]: 'Extension not loaded on this page. Try refreshing.',
    [ErrorCode.STORAGE_ERROR]: 'Failed to save settings. Please try again.',
    [ErrorCode.MESSAGE_ERROR]: 'Failed to communicate with extension. Try refreshing the page.',
    [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
};

/**
 * Custom error class for translation-related errors.
 */
export class TranslationError extends Error {
    readonly code: ErrorCode;
    readonly userMessage: string;
    readonly originalError?: unknown;

    constructor(code: ErrorCode, details?: string, originalError?: unknown) {
        const userMessage = ERROR_MESSAGES[code];
        const message = details ? `${userMessage} (${details})` : userMessage;
        super(message);

        this.name = 'TranslationError';
        this.code = code;
        this.userMessage = userMessage;
        this.originalError = originalError;
    }
}

/**
 * Get a user-friendly message for any error.
 */
export function getUserFriendlyMessage(error: unknown): string {
    if (error instanceof TranslationError) {
        return error.userMessage;
    }

    if (error instanceof Error) {
        // Check for common error patterns
        const msg = error.message.toLowerCase();

        if (msg.includes('api key') || msg.includes('apikey')) {
            return ERROR_MESSAGES[ErrorCode.INVALID_API_KEY];
        }
        if (msg.includes('rate') || msg.includes('429')) {
            return ERROR_MESSAGES[ErrorCode.RATE_LIMITED];
        }
        if (msg.includes('quota') || msg.includes('limit')) {
            return ERROR_MESSAGES[ErrorCode.QUOTA_EXCEEDED];
        }
        if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
            return ERROR_MESSAGES[ErrorCode.NETWORK_ERROR];
        }
        if (msg.includes('timeout')) {
            return ERROR_MESSAGES[ErrorCode.TIMEOUT_ERROR];
        }

        return error.message;
    }

    return ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];
}

/**
 * Determine error code from HTTP status code.
 */
export function getErrorCodeFromStatus(status: number): ErrorCode {
    switch (status) {
        case 401:
        case 403:
            return ErrorCode.INVALID_API_KEY;
        case 429:
            return ErrorCode.RATE_LIMITED;
        case 503:
        case 504:
            return ErrorCode.TIMEOUT_ERROR;
        default:
            return ErrorCode.API_ERROR;
    }
}

/**
 * Safely parse JSON with error handling.
 */
export function safeJsonParse<T>(text: string, fallback?: T): T {
    try {
        return JSON.parse(text) as T;
    } catch (e) {
        if (fallback !== undefined) {
            return fallback;
        }
        throw new TranslationError(ErrorCode.JSON_PARSE_ERROR, 'Invalid JSON response', e);
    }
}

/**
 * Check for Chrome runtime errors after API calls.
 */
export function checkChromeError(): TranslationError | null {
    if (chrome.runtime.lastError) {
        return new TranslationError(
            ErrorCode.MESSAGE_ERROR,
            chrome.runtime.lastError.message
        );
    }
    return null;
}

