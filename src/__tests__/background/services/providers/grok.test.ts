/**
 * Tests for src/background/services/providers/grok.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorCode } from '@/lib/errors';
import { fetchGrok, fetchGrokStream } from '@/background/services/providers/grok';

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

describe('fetchGrokStream', () => {
    const apiKey = 'test-grok-key';
    const model = 'grok-beta';
    const systemPrompt = 'Translate from English to Spanish';
    const userPrompt = '["Hello", "World"]';

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should call onChunk with content deltas from SSE stream', async () => {
        const onChunk = vi.fn();
        const sseChunks = [
            'data: {"choices":[{"delta":{"content":"[\\"Hola"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"\\", "}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"\\"Mundo\\"]"}}]}\n\n',
            'data: [DONE]\n\n'
        ];

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            body: createMockSSEStream(sseChunks),
        }));

        await fetchGrokStream(apiKey, model, systemPrompt, userPrompt, onChunk);

        expect(onChunk).toHaveBeenCalledTimes(3);
        expect(onChunk).toHaveBeenNthCalledWith(1, '["Hola');
        expect(onChunk).toHaveBeenNthCalledWith(2, '", ');
        expect(onChunk).toHaveBeenNthCalledWith(3, '"Mundo"]');
    });

    it('should throw NETWORK_ERROR on fetch failure', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));
        const onChunk = vi.fn();

        await expect(fetchGrokStream(apiKey, model, systemPrompt, userPrompt, onChunk))
            .rejects.toMatchObject({ code: ErrorCode.NETWORK_ERROR });

        expect(onChunk).not.toHaveBeenCalled();
    });

    it('should throw INVALID_API_KEY on 401', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            text: () => Promise.resolve('{"error": {"message": "Unauthorized"}}'),
        }));
        const onChunk = vi.fn();

        await expect(fetchGrokStream(apiKey, model, systemPrompt, userPrompt, onChunk))
            .rejects.toMatchObject({ code: ErrorCode.INVALID_API_KEY });
    });

    it('should throw RATE_LIMITED on 429', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 429,
            text: () => Promise.resolve('{"error": {"message": "Too many requests"}}'),
        }));
        const onChunk = vi.fn();

        await expect(fetchGrokStream(apiKey, model, systemPrompt, userPrompt, onChunk))
            .rejects.toMatchObject({ code: ErrorCode.RATE_LIMITED });
    });

    it('should throw INVALID_RESPONSE when no response body', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            body: null,
        }));
        const onChunk = vi.fn();

        await expect(fetchGrokStream(apiKey, model, systemPrompt, userPrompt, onChunk))
            .rejects.toMatchObject({ code: ErrorCode.INVALID_RESPONSE });
    });

    it('should include stream:true in request body', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            body: createMockSSEStream(['data: [DONE]\n\n']),
        });
        vi.stubGlobal('fetch', mockFetch);

        await fetchGrokStream(apiKey, model, systemPrompt, userPrompt, vi.fn());

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(requestBody.stream).toBe(true);
    });

    it('should skip chunks without delta content', async () => {
        const onChunk = vi.fn();
        const sseChunks = [
            'data: {"choices":[{"delta":{}}]}\n\n', // No content
            'data: {"choices":[{"delta":{"content":"valid"}}]}\n\n',
            'data: {"choices":[]}\n\n', // Empty choices
            'data: [DONE]\n\n'
        ];

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            body: createMockSSEStream(sseChunks),
        }));

        await fetchGrokStream(apiKey, model, systemPrompt, userPrompt, onChunk);

        expect(onChunk).toHaveBeenCalledTimes(1);
        expect(onChunk).toHaveBeenCalledWith('valid');
    });

    it('should handle incomplete SSE lines in buffer', async () => {
        const onChunk = vi.fn();
        // This simulates a chunk split in the middle of a line
        const sseChunks = [
            'data: {"choices":[{"delta":{"content":"part1"}}]}\ndata: {"choi',
            'ces":[{"delta":{"content":"part2"}}]}\n\ndata: [DONE]\n\n'
        ];

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            body: createMockSSEStream(sseChunks),
        }));

        await fetchGrokStream(apiKey, model, systemPrompt, userPrompt, onChunk);

        expect(onChunk).toHaveBeenCalledWith('part1');
        expect(onChunk).toHaveBeenCalledWith('part2');
    });

    it('should ignore malformed JSON in SSE data', async () => {
        const onChunk = vi.fn();
        const sseChunks = [
            'data: not valid json\n\n',
            'data: {"choices":[{"delta":{"content":"valid"}}]}\n\n',
            'data: [DONE]\n\n'
        ];

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            body: createMockSSEStream(sseChunks),
        }));

        await fetchGrokStream(apiKey, model, systemPrompt, userPrompt, onChunk);

        // Should not throw, just skip the malformed line
        expect(onChunk).toHaveBeenCalledTimes(1);
        expect(onChunk).toHaveBeenCalledWith('valid');
    });

    it('should call correct x.ai endpoint with streaming', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            body: createMockSSEStream(['data: [DONE]\n\n']),
        });
        vi.stubGlobal('fetch', mockFetch);

        await fetchGrokStream(apiKey, model, systemPrompt, userPrompt, vi.fn());

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.x.ai/v1/chat/completions',
            expect.any(Object)
        );
    });
});
