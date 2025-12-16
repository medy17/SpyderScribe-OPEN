/**
 * Tests for src/background/services/providers/openai.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorCode } from '@/lib/errors';
import { fetchOpenAI, fetchOpenAIStream } from '@/background/services/providers/openai';

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

describe('fetchOpenAI', () => {
    const apiKey = 'test-openai-key';
    const model = 'gpt-4';
    const systemPrompt = 'Translate from English to Spanish';
    const userPrompt = '["Hello", "World"]';

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('Single Batch', () => {
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

            const result = await fetchOpenAI(apiKey, model, systemPrompt, userPrompt);
            expect(result).toEqual(['Hola', 'Mundo']);
        });

        it('should extract JSON from markdown code blocks', async () => {
            const mockResponse = {
                choices: [{
                    message: {
                        content: '```json\n["Hola", "Mundo"]\n```'
                    }
                }]
            };

            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            }));

            const result = await fetchOpenAI(apiKey, model, systemPrompt, userPrompt);
            expect(result).toEqual(['Hola', 'Mundo']);
        });

        it('should throw NETWORK_ERROR on fetch failure', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

            await expect(fetchOpenAI(apiKey, model, systemPrompt, userPrompt))
                .rejects.toMatchObject({ code: ErrorCode.NETWORK_ERROR });
        });

        it('should throw INVALID_API_KEY on 401', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
                text: () => Promise.resolve('{"error": {"message": "Invalid API key"}}'),
            }));

            await expect(fetchOpenAI(apiKey, model, systemPrompt, userPrompt))
                .rejects.toMatchObject({ code: ErrorCode.INVALID_API_KEY });
        });

        it('should throw INVALID_RESPONSE when no content', async () => {
            const mockResponse = {
                choices: [{ message: {} }]
            };

            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            }));

            await expect(fetchOpenAI(apiKey, model, systemPrompt, userPrompt))
                .rejects.toMatchObject({ code: ErrorCode.INVALID_RESPONSE });
        });

        it('should throw JSON_PARSE_ERROR for invalid JSON', async () => {
            const mockResponse = {
                choices: [{
                    message: {
                        content: 'not valid json'
                    }
                }]
            };

            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            }));

            await expect(fetchOpenAI(apiKey, model, systemPrompt, userPrompt))
                .rejects.toMatchObject({ code: ErrorCode.JSON_PARSE_ERROR });
        });
    });

    describe('Chunking for Large Batches', () => {
        it('should chunk arrays larger than 20 items', async () => {
            const largeArray = Array.from({ length: 25 }, (_, i) => `item${i}`);
            const largePrompt = JSON.stringify(largeArray);

            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{ message: { content: JSON.stringify(largeArray.slice(0, 20).map(s => `translated_${s}`)) } }]
                }),
            });
            vi.stubGlobal('fetch', mockFetch);

            // Reset for second call
            let callCount = 0;
            mockFetch.mockImplementation(() => {
                callCount++;
                const chunkSize = callCount === 1 ? 20 : 5;
                const translations = Array.from({ length: chunkSize }, (_, i) => `translated_${i}`);
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        choices: [{ message: { content: JSON.stringify(translations) } }]
                    }),
                });
            });

            const result = await fetchOpenAI(apiKey, model, systemPrompt, largePrompt);

            expect(mockFetch).toHaveBeenCalledTimes(2); // 20 + 5
            expect(result).toHaveLength(25);
        });

        it('should throw RESPONSE_MISMATCH when chunk count differs', async () => {
            const largeArray = Array.from({ length: 25 }, (_, i) => `item${i}`);
            const largePrompt = JSON.stringify(largeArray);

            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{ message: { content: '["only", "two"]' } }] // Returns 2 instead of 20
                }),
            }));

            await expect(fetchOpenAI(apiKey, model, systemPrompt, largePrompt))
                .rejects.toMatchObject({ code: ErrorCode.RESPONSE_MISMATCH });
        });
    });

    describe('Request Format', () => {
        it('should call correct OpenAI endpoint', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{ message: { content: '[]' } }]
                }),
            });
            vi.stubGlobal('fetch', mockFetch);

            await fetchOpenAI(apiKey, model, systemPrompt, '[]');

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.openai.com/v1/chat/completions',
                expect.any(Object)
            );
        });

        it('should include Authorization header', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{ message: { content: '[]' } }]
                }),
            });
            vi.stubGlobal('fetch', mockFetch);

            await fetchOpenAI(apiKey, model, systemPrompt, '[]');

            const callArgs = mockFetch.mock.calls[0][1];
            expect(callArgs.headers.Authorization).toBe(`Bearer ${apiKey}`);
        });
    });
});

describe('fetchOpenAIStream', () => {
    const apiKey = 'test-openai-key';
    const model = 'gpt-4';
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

        await fetchOpenAIStream(apiKey, model, systemPrompt, userPrompt, onChunk);

        expect(onChunk).toHaveBeenCalledTimes(3);
        expect(onChunk).toHaveBeenNthCalledWith(1, '["Hola');
        expect(onChunk).toHaveBeenNthCalledWith(2, '", ');
        expect(onChunk).toHaveBeenNthCalledWith(3, '"Mundo"]');
    });

    it('should throw NETWORK_ERROR on fetch failure', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));
        const onChunk = vi.fn();

        await expect(fetchOpenAIStream(apiKey, model, systemPrompt, userPrompt, onChunk))
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

        await expect(fetchOpenAIStream(apiKey, model, systemPrompt, userPrompt, onChunk))
            .rejects.toMatchObject({ code: ErrorCode.INVALID_API_KEY });
    });

    it('should throw RATE_LIMITED on 429', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 429,
            text: () => Promise.resolve('{"error": {"message": "Too many requests"}}'),
        }));
        const onChunk = vi.fn();

        await expect(fetchOpenAIStream(apiKey, model, systemPrompt, userPrompt, onChunk))
            .rejects.toMatchObject({ code: ErrorCode.RATE_LIMITED });
    });

    it('should throw INVALID_RESPONSE when no response body', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            body: null,
        }));
        const onChunk = vi.fn();

        await expect(fetchOpenAIStream(apiKey, model, systemPrompt, userPrompt, onChunk))
            .rejects.toMatchObject({ code: ErrorCode.INVALID_RESPONSE });
    });

    it('should include stream:true in request body', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            body: createMockSSEStream(['data: [DONE]\n\n']),
        });
        vi.stubGlobal('fetch', mockFetch);

        await fetchOpenAIStream(apiKey, model, systemPrompt, userPrompt, vi.fn());

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

        await fetchOpenAIStream(apiKey, model, systemPrompt, userPrompt, onChunk);

        expect(onChunk).toHaveBeenCalledTimes(1);
        expect(onChunk).toHaveBeenCalledWith('valid');
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

        await fetchOpenAIStream(apiKey, model, systemPrompt, userPrompt, onChunk);

        // Should not throw, just skip the malformed line
        expect(onChunk).toHaveBeenCalledTimes(1);
        expect(onChunk).toHaveBeenCalledWith('valid');
    });

    it('should handle chunking for large batches with streaming', async () => {
        const largeArray = Array.from({ length: 25 }, (_, i) => `item${i}`);
        const largePrompt = JSON.stringify(largeArray);
        const onChunk = vi.fn();

        // Should make 2 streaming calls (20 + 5)
        let callCount = 0;
        vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
            callCount++;
            return Promise.resolve({
                ok: true,
                body: createMockSSEStream([
                    `data: {"choices":[{"delta":{"content":"chunk${callCount}"}}]}\n\n`,
                    'data: [DONE]\n\n'
                ]),
            });
        }));

        await fetchOpenAIStream(apiKey, model, systemPrompt, largePrompt, onChunk);

        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
        expect(onChunk).toHaveBeenCalledWith('chunk1');
        expect(onChunk).toHaveBeenCalledWith('chunk2');
    });

    it('should call correct OpenAI endpoint with streaming', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            body: createMockSSEStream(['data: [DONE]\n\n']),
        });
        vi.stubGlobal('fetch', mockFetch);

        await fetchOpenAIStream(apiKey, model, systemPrompt, userPrompt, vi.fn());

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.openai.com/v1/chat/completions',
            expect.any(Object)
        );
    });

    it('should include Authorization header in streaming request', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            body: createMockSSEStream(['data: [DONE]\n\n']),
        });
        vi.stubGlobal('fetch', mockFetch);

        await fetchOpenAIStream(apiKey, model, systemPrompt, userPrompt, vi.fn());

        const callArgs = mockFetch.mock.calls[0][1];
        expect(callArgs.headers.Authorization).toBe(`Bearer ${apiKey}`);
    });
});
