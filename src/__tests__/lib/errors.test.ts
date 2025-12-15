/**
 * Tests for src/lib/errors.ts
 */
import { describe, it, expect } from 'vitest';
import {
    ErrorCode,
    TranslationError,
    getUserFriendlyMessage,
    getErrorCodeFromStatus,
    safeJsonParse,
    checkChromeError,
} from '@/lib/errors';
import { chromeMock } from '../setup';

describe('ErrorCode', () => {
    it('should have all expected error codes', () => {
        expect(ErrorCode.GEMINI_API_KEY_MISSING).toBe('GEMINI_API_KEY_MISSING');
        expect(ErrorCode.GROK_API_KEY_MISSING).toBe('GROK_API_KEY_MISSING');
        expect(ErrorCode.OPENAI_API_KEY_MISSING).toBe('OPENAI_API_KEY_MISSING');
        expect(ErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
        expect(ErrorCode.JSON_PARSE_ERROR).toBe('JSON_PARSE_ERROR');
        expect(ErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });
});

describe('TranslationError', () => {
    it('should create error with code and message', () => {
        const error = new TranslationError(ErrorCode.NETWORK_ERROR);

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('TranslationError');
        expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
        expect(error.userMessage).toBe('Network error. Please check your connection.');
    });

    it('should include details in message', () => {
        const error = new TranslationError(ErrorCode.API_ERROR, 'Server timeout');

        expect(error.message).toContain('Server timeout');
        expect(error.userMessage).toBe('API error occurred. Please try again.');
    });

    it('should store original error', () => {
        const originalError = new Error('Original');
        const error = new TranslationError(ErrorCode.JSON_PARSE_ERROR, 'Bad JSON', originalError);

        expect(error.originalError).toBe(originalError);
    });
});

describe('getUserFriendlyMessage', () => {
    it('should return userMessage for TranslationError', () => {
        const error = new TranslationError(ErrorCode.RATE_LIMITED);
        expect(getUserFriendlyMessage(error)).toBe('Rate limited. Please wait a moment before trying again.');
    });

    it('should detect API key errors in generic errors', () => {
        const error = new Error('Invalid api key provided');
        expect(getUserFriendlyMessage(error)).toBe('Invalid API key. Please check your key in Settings.');
    });

    it('should detect rate limiting in generic errors', () => {
        const error = new Error('Rate limit exceeded (429)');
        expect(getUserFriendlyMessage(error)).toBe('Rate limited. Please wait a moment before trying again.');
    });

    it('should detect network errors', () => {
        const error = new Error('Failed to fetch');
        expect(getUserFriendlyMessage(error)).toBe('Network error. Please check your connection.');
    });

    it('should return unknown error for non-Error values', () => {
        expect(getUserFriendlyMessage('string error')).toBe('An unexpected error occurred. Please try again.');
        expect(getUserFriendlyMessage(null)).toBe('An unexpected error occurred. Please try again.');
    });

    it('should return error message for unrecognized Error', () => {
        const error = new Error('Some custom error');
        expect(getUserFriendlyMessage(error)).toBe('Some custom error');
    });
});

describe('getErrorCodeFromStatus', () => {
    it('should return INVALID_API_KEY for 401', () => {
        expect(getErrorCodeFromStatus(401)).toBe(ErrorCode.INVALID_API_KEY);
    });

    it('should return INVALID_API_KEY for 403', () => {
        expect(getErrorCodeFromStatus(403)).toBe(ErrorCode.INVALID_API_KEY);
    });

    it('should return RATE_LIMITED for 429', () => {
        expect(getErrorCodeFromStatus(429)).toBe(ErrorCode.RATE_LIMITED);
    });

    it('should return TIMEOUT_ERROR for 503 and 504', () => {
        expect(getErrorCodeFromStatus(503)).toBe(ErrorCode.TIMEOUT_ERROR);
        expect(getErrorCodeFromStatus(504)).toBe(ErrorCode.TIMEOUT_ERROR);
    });

    it('should return API_ERROR for other status codes', () => {
        expect(getErrorCodeFromStatus(500)).toBe(ErrorCode.API_ERROR);
        expect(getErrorCodeFromStatus(502)).toBe(ErrorCode.API_ERROR);
    });
});

describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
        const result = safeJsonParse<string[]>('["hello", "world"]');
        expect(result).toEqual(['hello', 'world']);
    });

    it('should return fallback for invalid JSON', () => {
        const result = safeJsonParse<string[]>('invalid', []);
        expect(result).toEqual([]);
    });

    it('should throw TranslationError without fallback', () => {
        expect(() => safeJsonParse('invalid')).toThrow(TranslationError);
    });

    it('should throw with JSON_PARSE_ERROR code', () => {
        try {
            safeJsonParse('invalid');
        } catch (e) {
            expect(e).toBeInstanceOf(TranslationError);
            expect((e as TranslationError).code).toBe(ErrorCode.JSON_PARSE_ERROR);
        }
    });
});

describe('checkChromeError', () => {
    it('should return null when no error', () => {
        chromeMock.runtime.lastError = null;
        expect(checkChromeError()).toBeNull();
    });

    it('should return TranslationError when chrome has error', () => {
        chromeMock.runtime.lastError = { message: 'Extension context invalidated' };
        const error = checkChromeError();

        expect(error).toBeInstanceOf(TranslationError);
        expect(error?.code).toBe(ErrorCode.MESSAGE_ERROR);
    });
});
