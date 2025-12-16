/**
 * Tests for src/background/services/providers/gemini.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranslationError, ErrorCode } from '@/lib/errors';
import { fetchGemini, fetchGeminiStream } from '@/background/services/providers/gemini';

/**
 * Helper to create a mock ReadableStream from SSE text chunks
 */
function createMockSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let index = 0;

    return new ReadableStream({
        pull(controller) {
            if (index < chunks.length) {
                controller.enqueue(encoder.encode(chunks[index]));
                index++;
            } else {
                controller.close();
            }
        }
    });
}

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

describe('fetchGeminiStream', () => {
    const apiKey = 'test-api-key';
    const model = 'models/gemini-pro';
    const systemPrompt = 'Translate from English to Spanish';
    const userPrompt = '["Hello", "World"]';

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should call onChunk with content from SSE stream', async () => {
        const onChunk = vi.fn();
        const sseChunks = [
            'data: {"candidates":[{"content":{"parts":[{"text":"[\\"Hola"}]}}]}\n\n',
            'data: {"candidates":[{"content":{"parts":[{"text":"\\", \\"Mundo\\"]"}]}}]}\n\n',
        ];

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            body: createMockSSEStream(sseChunks),
        }));

        await fetchGeminiStream(apiKey, model, systemPrompt, userPrompt, onChunk);

        expect(onChunk).toHaveBeenCalledTimes(2);
        expect(onChunk).toHaveBeenNthCalledWith(1, '["Hola');
        expect(onChunk).toHaveBeenNthCalledWith(2, '", "Mundo"]');
    });

    it('should throw NETWORK_ERROR on fetch failure', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));
        const onChunk = vi.fn();

        await expect(fetchGeminiStream(apiKey, model, systemPrompt, userPrompt, onChunk))
            .rejects.toMatchObject({ code: ErrorCode.NETWORK_ERROR });

        expect(onChunk).not.toHaveBeenCalled();
    });

    it('should throw INVALID_API_KEY on 401', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            text: () => Promise.resolve('{"error": {"message": "Invalid API key"}}'),
        }));
        const onChunk = vi.fn();

        await expect(fetchGeminiStream(apiKey, model, systemPrompt, userPrompt, onChunk))
            .rejects.toMatchObject({ code: ErrorCode.INVALID_API_KEY });
    });

    it('should throw RATE_LIMITED on 429', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 429,
            text: () => Promise.resolve('{"error": {"message": "Rate limited"}}'),
        }));
        const onChunk = vi.fn();

        await expect(fetchGeminiStream(apiKey, model, systemPrompt, userPrompt, onChunk))
            .rejects.toMatchObject({ code: ErrorCode.RATE_LIMITED });
    });

    it('should throw INVALID_RESPONSE when no response body', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            body: null,
        }));
        const onChunk = vi.fn();

        await expect(fetchGeminiStream(apiKey, model, systemPrompt, userPrompt, onChunk))
            .rejects.toMatchObject({ code: ErrorCode.INVALID_RESPONSE });
    });

    it('should use streaming URL with alt=sse', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            body: createMockSSEStream([]),
        });
        vi.stubGlobal('fetch', mockFetch);

        await fetchGeminiStream(apiKey, model, systemPrompt, userPrompt, vi.fn());

        expect(mockFetch.mock.calls[0][0]).toContain('streamGenerateContent');
        expect(mockFetch.mock.calls[0][0]).toContain('alt=sse');
    });

    it('should skip lines without valid content', async () => {
        const onChunk = vi.fn();
        const sseChunks = [
            'data: {"candidates":[{"content":{"parts":[]}}]}\n\n', // No text
            'data: {"candidates":[{"content":{"parts":[{"text":"valid"}]}}]}\n\n',
            'data: [DONE]\n\n'
        ];

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            body: createMockSSEStream(sseChunks),
        }));

        await fetchGeminiStream(apiKey, model, systemPrompt, userPrompt, onChunk);

        expect(onChunk).toHaveBeenCalledTimes(1);
        expect(onChunk).toHaveBeenCalledWith('valid');
    });

    it('should ignore malformed JSON in SSE data', async () => {
        const onChunk = vi.fn();
        const sseChunks = [
            'data: not valid json\n\n',
            'data: {"candidates":[{"content":{"parts":[{"text":"valid"}]}}]}\n\n',
        ];

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            body: createMockSSEStream(sseChunks),
        }));

        await fetchGeminiStream(apiKey, model, systemPrompt, userPrompt, onChunk);

        // Should not throw, just skip the malformed line
        expect(onChunk).toHaveBeenCalledTimes(1);
        expect(onChunk).toHaveBeenCalledWith('valid');
    });

    it('should include API key in streaming URL', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            body: createMockSSEStream([]),
        });
        vi.stubGlobal('fetch', mockFetch);

        await fetchGeminiStream(apiKey, model, systemPrompt, userPrompt, vi.fn());

        expect(mockFetch.mock.calls[0][0]).toContain(apiKey);
    });
});
