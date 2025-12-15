/**
 * Tests for src/background/services/providers/gemini.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranslationError, ErrorCode } from '@/lib/errors';
import { fetchGemini } from '@/background/services/providers/gemini';

describe('fetchGemini', () => {
    const apiKey = 'test-api-key';
    const model = 'models/gemini-pro';
    const systemPrompt = 'Translate from English to Spanish';
    const userPrompt = '["Hello", "World"]';

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should return translated array on success', async () => {
        const mockResponse = {
            candidates: [{
                content: {
                    parts: [{ text: '["Hola", "Mundo"]' }]
                },
                finishReason: 'STOP'
            }]
        };

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockResponse),
        }));

        const result = await fetchGemini(apiKey, model, systemPrompt, userPrompt);
        expect(result).toEqual(['Hola', 'Mundo']);
    });

    it('should throw NETWORK_ERROR on fetch failure', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

        await expect(fetchGemini(apiKey, model, systemPrompt, userPrompt))
            .rejects.toThrow(TranslationError);

        try {
            await fetchGemini(apiKey, model, systemPrompt, userPrompt);
        } catch (e) {
            expect((e as TranslationError).code).toBe(ErrorCode.NETWORK_ERROR);
        }
    });

    it('should throw INVALID_API_KEY on 401', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            text: () => Promise.resolve('{"error": {"message": "Invalid API key"}}'),
        }));

        await expect(fetchGemini(apiKey, model, systemPrompt, userPrompt))
            .rejects.toMatchObject({ code: ErrorCode.INVALID_API_KEY });
    });

    it('should throw RATE_LIMITED on 429', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 429,
            text: () => Promise.resolve('{"error": {"message": "Rate limited"}}'),
        }));

        await expect(fetchGemini(apiKey, model, systemPrompt, userPrompt))
            .rejects.toMatchObject({ code: ErrorCode.RATE_LIMITED });
    });

    it('should throw API_ERROR when response is blocked', async () => {
        const mockResponse = {
            candidates: [{
                content: { parts: [] },
                finishReason: 'SAFETY'
            }]
        };

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockResponse),
        }));

        await expect(fetchGemini(apiKey, model, systemPrompt, userPrompt))
            .rejects.toMatchObject({ code: ErrorCode.API_ERROR });
    });

    it('should throw INVALID_RESPONSE when no text in response', async () => {
        const mockResponse = {
            candidates: [{
                content: { parts: [] },
                finishReason: 'STOP'
            }]
        };

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockResponse),
        }));

        await expect(fetchGemini(apiKey, model, systemPrompt, userPrompt))
            .rejects.toMatchObject({ code: ErrorCode.INVALID_RESPONSE });
    });

    it('should construct correct URL with API key', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                candidates: [{ content: { parts: [{ text: '[]' }] } }]
            }),
        });
        vi.stubGlobal('fetch', mockFetch);

        await fetchGemini(apiKey, model, systemPrompt, userPrompt);

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining(apiKey),
            expect.any(Object)
        );
        expect(mockFetch.mock.calls[0][0]).toContain(model);
    });
});
