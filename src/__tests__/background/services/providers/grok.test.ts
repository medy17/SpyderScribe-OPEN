/**
 * Tests for src/background/services/providers/grok.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorCode } from '@/lib/errors';
import { fetchGrok } from '@/background/services/providers/grok';

describe('fetchGrok', () => {
    const apiKey = 'test-grok-key';
    const model = 'grok-beta';
    const systemPrompt = 'Translate from English to Spanish';
    const userPrompt = '["Hello", "World"]';

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should return translated array on success', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: '["Hola", "Mundo"]'
                }
            }]
        };

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockResponse),
        }));

        const result = await fetchGrok(apiKey, model, systemPrompt, userPrompt);
        expect(result).toEqual(['Hola', 'Mundo']);
    });

    it('should throw NETWORK_ERROR on fetch failure', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

        await expect(fetchGrok(apiKey, model, systemPrompt, userPrompt))
            .rejects.toMatchObject({ code: ErrorCode.NETWORK_ERROR });
    });

    it('should throw INVALID_API_KEY on 401', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            text: () => Promise.resolve('{"error": {"message": "Unauthorized"}}'),
        }));

        await expect(fetchGrok(apiKey, model, systemPrompt, userPrompt))
            .rejects.toMatchObject({ code: ErrorCode.INVALID_API_KEY });
    });

    it('should throw RATE_LIMITED on 429', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 429,
            text: () => Promise.resolve('{"error": {"message": "Too many requests"}}'),
        }));

        await expect(fetchGrok(apiKey, model, systemPrompt, userPrompt))
            .rejects.toMatchObject({ code: ErrorCode.RATE_LIMITED });
    });

    it('should throw INVALID_RESPONSE when no content', async () => {
        const mockResponse = {
            choices: [{ message: {} }]
        };

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockResponse),
        }));

        await expect(fetchGrok(apiKey, model, systemPrompt, userPrompt))
            .rejects.toMatchObject({ code: ErrorCode.INVALID_RESPONSE });
    });

    it('should call correct x.ai endpoint', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: '[]' } }]
            }),
        });
        vi.stubGlobal('fetch', mockFetch);

        await fetchGrok(apiKey, model, systemPrompt, userPrompt);

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.x.ai/v1/chat/completions',
            expect.any(Object)
        );
    });
});
