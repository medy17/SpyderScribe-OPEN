/**
 * Tests for src/background/services/translation.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranslationError, ErrorCode } from '@/lib/errors';

// Mock the providers - include both batch and streaming functions
vi.mock('@/background/services/providers/gemini', () => ({
    fetchGemini: vi.fn(),
    fetchGeminiStream: vi.fn(),
}));
vi.mock('@/background/services/providers/grok', () => ({
    fetchGrok: vi.fn(),
    fetchGrokStream: vi.fn(),
}));
vi.mock('@/background/services/providers/openai', () => ({
    fetchOpenAI: vi.fn(),
    fetchOpenAIStream: vi.fn(),
}));

import { callAI, callAIStream } from '@/background/services/translation';
import { fetchGemini, fetchGeminiStream } from '@/background/services/providers/gemini';
import { fetchGrok, fetchGrokStream } from '@/background/services/providers/grok';
import { fetchOpenAI, fetchOpenAIStream } from '@/background/services/providers/openai';

describe('callAI', () => {
    const textArray = ['Hello', 'World'];
    const source = 'English';
    const target = 'Spanish';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Provider Routing', () => {
        it('should route grok-* models to fetchGrok', async () => {
            vi.mocked(fetchGrok).mockResolvedValue(['Hola', 'Mundo']);

            const result = await callAI(textArray, source, target, 'grok-beta', '', 'grok-key', '');

            expect(fetchGrok).toHaveBeenCalledWith('grok-key', 'grok-beta', expect.any(String), expect.any(String));
            expect(result).toEqual(['Hola', 'Mundo']);
        });

        it('should route gpt-* models to fetchOpenAI', async () => {
            vi.mocked(fetchOpenAI).mockResolvedValue(['Hola', 'Mundo']);

            const result = await callAI(textArray, source, target, 'gpt-4', '', '', 'openai-key');

            expect(fetchOpenAI).toHaveBeenCalledWith('openai-key', 'gpt-4', expect.any(String), expect.any(String));
            expect(result).toEqual(['Hola', 'Mundo']);
        });

        it('should route other models to fetchGemini', async () => {
            vi.mocked(fetchGemini).mockResolvedValue(['Hola', 'Mundo']);

            const result = await callAI(textArray, source, target, 'gemini-pro', 'gemini-key', '', '');

            expect(fetchGemini).toHaveBeenCalledWith('gemini-key', 'gemini-pro', expect.any(String), expect.any(String));
            expect(result).toEqual(['Hola', 'Mundo']);
        });

        it('should use default model when none specified', async () => {
            vi.mocked(fetchGemini).mockResolvedValue(['Hola', 'Mundo']);

            await callAI(textArray, source, target, '', 'gemini-key', '', '');

            expect(fetchGemini).toHaveBeenCalledWith('gemini-key', 'models/gemini-2.5-flash', expect.any(String), expect.any(String));
        });
    });

    describe('API Key Validation', () => {
        it('should throw when Grok model but no Grok key', async () => {
            await expect(callAI(textArray, source, target, 'grok-beta', '', '', ''))
                .rejects.toThrow(TranslationError);

            try {
                await callAI(textArray, source, target, 'grok-beta', '', '', '');
            } catch (e) {
                expect((e as TranslationError).code).toBe(ErrorCode.GROK_API_KEY_MISSING);
            }
        });

        it('should throw when OpenAI model but no OpenAI key', async () => {
            await expect(callAI(textArray, source, target, 'gpt-4', '', '', ''))
                .rejects.toThrow(TranslationError);

            try {
                await callAI(textArray, source, target, 'gpt-4', '', '', '');
            } catch (e) {
                expect((e as TranslationError).code).toBe(ErrorCode.OPENAI_API_KEY_MISSING);
            }
        });

        it('should throw when Gemini model but no Gemini key', async () => {
            await expect(callAI(textArray, source, target, 'gemini-pro', '', '', ''))
                .rejects.toThrow(TranslationError);

            try {
                await callAI(textArray, source, target, 'gemini-pro', '', '', '');
            } catch (e) {
                expect((e as TranslationError).code).toBe(ErrorCode.GEMINI_API_KEY_MISSING);
            }
        });
    });

    describe('System Prompt Construction', () => {
        it('should include source and target languages in prompt', async () => {
            vi.mocked(fetchGemini).mockResolvedValue(['Hola']);

            await callAI(['Hello'], 'English', 'Spanish', '', 'key', '', '');

            const call = vi.mocked(fetchGemini).mock.calls[0];
            const systemPrompt = call[2];
            expect(systemPrompt).toContain('English');
            expect(systemPrompt).toContain('Spanish');
        });
    });
});

describe('callAIStream', () => {
    const textArray = ['Hello', 'World'];
    const source = 'English';
    const target = 'Spanish';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Provider Routing', () => {
        it('should route grok-* models to fetchGrokStream', async () => {
            vi.mocked(fetchGrokStream).mockResolvedValue(undefined);
            const onChunk = vi.fn();

            await callAIStream(textArray, source, target, 'grok-beta', '', 'grok-key', '', onChunk);

            expect(fetchGrokStream).toHaveBeenCalledWith(
                'grok-key',
                'grok-beta',
                expect.any(String),
                expect.any(String),
                onChunk
            );
            expect(fetchGeminiStream).not.toHaveBeenCalled();
            expect(fetchOpenAIStream).not.toHaveBeenCalled();
        });

        it('should route gpt-* models to fetchOpenAIStream', async () => {
            vi.mocked(fetchOpenAIStream).mockResolvedValue(undefined);
            const onChunk = vi.fn();

            await callAIStream(textArray, source, target, 'gpt-4', '', '', 'openai-key', onChunk);

            expect(fetchOpenAIStream).toHaveBeenCalledWith(
                'openai-key',
                'gpt-4',
                expect.any(String),
                expect.any(String),
                onChunk
            );
            expect(fetchGeminiStream).not.toHaveBeenCalled();
            expect(fetchGrokStream).not.toHaveBeenCalled();
        });

        it('should route other models to fetchGeminiStream', async () => {
            vi.mocked(fetchGeminiStream).mockResolvedValue(undefined);
            const onChunk = vi.fn();

            await callAIStream(textArray, source, target, 'gemini-pro', 'gemini-key', '', '', onChunk);

            expect(fetchGeminiStream).toHaveBeenCalledWith(
                'gemini-key',
                'gemini-pro',
                expect.any(String),
                expect.any(String),
                onChunk
            );
            expect(fetchGrokStream).not.toHaveBeenCalled();
            expect(fetchOpenAIStream).not.toHaveBeenCalled();
        });

        it('should use default model when none specified', async () => {
            vi.mocked(fetchGeminiStream).mockResolvedValue(undefined);
            const onChunk = vi.fn();

            await callAIStream(textArray, source, target, '', 'gemini-key', '', '', onChunk);

            expect(fetchGeminiStream).toHaveBeenCalledWith(
                'gemini-key',
                'models/gemini-2.5-flash',
                expect.any(String),
                expect.any(String),
                onChunk
            );
        });
    });

    describe('API Key Validation', () => {
        it('should throw GROK_API_KEY_MISSING when Grok model but no Grok key', async () => {
            const onChunk = vi.fn();

            await expect(callAIStream(textArray, source, target, 'grok-beta', '', '', '', onChunk))
                .rejects.toMatchObject({ code: ErrorCode.GROK_API_KEY_MISSING });

            expect(fetchGrokStream).not.toHaveBeenCalled();
        });

        it('should throw OPENAI_API_KEY_MISSING when OpenAI model but no OpenAI key', async () => {
            const onChunk = vi.fn();

            await expect(callAIStream(textArray, source, target, 'gpt-4', '', '', '', onChunk))
                .rejects.toMatchObject({ code: ErrorCode.OPENAI_API_KEY_MISSING });

            expect(fetchOpenAIStream).not.toHaveBeenCalled();
        });

        it('should throw GEMINI_API_KEY_MISSING when Gemini model but no Gemini key', async () => {
            const onChunk = vi.fn();

            await expect(callAIStream(textArray, source, target, 'gemini-pro', '', '', '', onChunk))
                .rejects.toMatchObject({ code: ErrorCode.GEMINI_API_KEY_MISSING });

            expect(fetchGeminiStream).not.toHaveBeenCalled();
        });
    });

    describe('onChunk Callback Passthrough', () => {
        it('should pass onChunk callback to provider stream function', async () => {
            const onChunk = vi.fn();
            let capturedOnChunk: ((text: string) => void) | undefined;

            vi.mocked(fetchGeminiStream).mockImplementation(async (_key, _model, _sys, _user, cb) => {
                capturedOnChunk = cb;
                // Simulate some streaming
                cb('["Hola"');
                cb(', "Mundo"]');
            });

            await callAIStream(textArray, source, target, 'gemini-pro', 'gemini-key', '', '', onChunk);

            expect(capturedOnChunk).toBe(onChunk);
            expect(onChunk).toHaveBeenCalledTimes(2);
            expect(onChunk).toHaveBeenNthCalledWith(1, '["Hola"');
            expect(onChunk).toHaveBeenNthCalledWith(2, ', "Mundo"]');
        });
    });

    describe('Error Propagation', () => {
        it('should propagate network errors from provider', async () => {
            const onChunk = vi.fn();
            vi.mocked(fetchGeminiStream).mockRejectedValue(
                new TranslationError(ErrorCode.NETWORK_ERROR, 'Connection failed')
            );

            await expect(callAIStream(textArray, source, target, 'gemini-pro', 'key', '', '', onChunk))
                .rejects.toMatchObject({ code: ErrorCode.NETWORK_ERROR });
        });

        it('should propagate rate limit errors from provider', async () => {
            const onChunk = vi.fn();
            vi.mocked(fetchGrokStream).mockRejectedValue(
                new TranslationError(ErrorCode.RATE_LIMITED, 'Too many requests')
            );

            await expect(callAIStream(textArray, source, target, 'grok-beta', '', 'key', '', onChunk))
                .rejects.toMatchObject({ code: ErrorCode.RATE_LIMITED });
        });

        it('should propagate invalid API key errors from provider', async () => {
            const onChunk = vi.fn();
            vi.mocked(fetchOpenAIStream).mockRejectedValue(
                new TranslationError(ErrorCode.INVALID_API_KEY, 'Invalid key')
            );

            await expect(callAIStream(textArray, source, target, 'gpt-4', '', '', 'bad-key', onChunk))
                .rejects.toMatchObject({ code: ErrorCode.INVALID_API_KEY });
        });
    });

    describe('System Prompt Construction', () => {
        it('should include source and target languages in prompt', async () => {
            vi.mocked(fetchGeminiStream).mockResolvedValue(undefined);
            const onChunk = vi.fn();

            await callAIStream(['Hello'], 'French', 'German', '', 'key', '', '', onChunk);

            const call = vi.mocked(fetchGeminiStream).mock.calls[0];
            const systemPrompt = call[2];
            expect(systemPrompt).toContain('French');
            expect(systemPrompt).toContain('German');
        });

        it('should stringify text array as user prompt', async () => {
            vi.mocked(fetchGeminiStream).mockResolvedValue(undefined);
            const onChunk = vi.fn();

            await callAIStream(['Hello', 'World'], 'English', 'Spanish', '', 'key', '', '', onChunk);

            const call = vi.mocked(fetchGeminiStream).mock.calls[0];
            const userPrompt = call[3];
            expect(userPrompt).toBe('["Hello","World"]');
        });
    });
});
