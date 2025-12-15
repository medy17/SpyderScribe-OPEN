/**
 * Tests for src/background/services/providers/openai.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorCode } from '@/lib/errors';
import { fetchOpenAI } from '@/background/services/providers/openai';

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
