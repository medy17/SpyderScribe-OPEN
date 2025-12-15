/**
 * Tests for src/background/services/translation.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranslationError, ErrorCode } from '@/lib/errors';

// Mock the providers
vi.mock('@/background/services/providers/gemini', () => ({
    fetchGemini: vi.fn(),
}));
vi.mock('@/background/services/providers/grok', () => ({
    fetchGrok: vi.fn(),
}));
vi.mock('@/background/services/providers/openai', () => ({
    fetchOpenAI: vi.fn(),
}));

import { callAI } from '@/background/services/translation';
import { fetchGemini } from '@/background/services/providers/gemini';
import { fetchGrok } from '@/background/services/providers/grok';
import { fetchOpenAI } from '@/background/services/providers/openai';

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
