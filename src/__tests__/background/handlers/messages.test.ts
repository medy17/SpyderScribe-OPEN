/**
 * Tests for src/background/handlers/messages.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/background/services/translation', () => ({
    callAI: vi.fn(),
}));

vi.mock('@/background/services/cache', () => ({
    translationCache: {
        get: vi.fn(),
        set: vi.fn(),
        clear: vi.fn(),
        getStats: vi.fn(),
        getEntries: vi.fn(),
    },
}));

import { handleMessage } from '@/background/handlers/messages';
import type { MessageRequest } from '@/background/handlers/messages';
import { callAI } from '@/background/services/translation';
import { translationCache } from '@/background/services/cache';
import { mockStorage } from '../../setup';

describe('handleMessage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default storage values
        mockStorage['selectedModel'] = 'gemini-pro';
        mockStorage['geminiApiKey'] = 'test-key';
    });

    describe('translateBatch action', () => {
        it('should return cached translations when available', async () => {
            vi.mocked(translationCache.get).mockResolvedValue('Hola');

            const sendResponse = vi.fn();
            const request = {
                action: 'translateBatch' as const,
                texts: ['Hello'],
                source: 'English',
                target: 'Spanish',
            };

            const result = handleMessage(request, sendResponse);
            expect(result).toBe(true); // Async

            // Wait for async
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(sendResponse).toHaveBeenCalledWith({
                success: true,
                translations: ['Hola'],
            });
            expect(callAI).not.toHaveBeenCalled();
        });

        it('should call API for uncached translations', async () => {
            vi.mocked(translationCache.get).mockResolvedValue(null);
            vi.mocked(callAI).mockResolvedValue(['Hola']);
            vi.mocked(translationCache.set).mockResolvedValue();

            const sendResponse = vi.fn();
            const request = {
                action: 'translateBatch' as const,
                texts: ['Hello'],
                source: 'English',
                target: 'Spanish',
            };

            handleMessage(request, sendResponse);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(callAI).toHaveBeenCalled();
            expect(translationCache.set).toHaveBeenCalledWith('English', 'Spanish', 'Hello', 'Hola');
            expect(sendResponse).toHaveBeenCalledWith({
                success: true,
                translations: ['Hola'],
            });
        });

        it('should return error response on failure', async () => {
            vi.mocked(translationCache.get).mockResolvedValue(null);
            vi.mocked(callAI).mockRejectedValue(new Error('API failed'));

            const sendResponse = vi.fn();
            const request = {
                action: 'translateBatch' as const,
                texts: ['Hello'],
                source: 'English',
                target: 'Spanish',
            };

            handleMessage(request, sendResponse);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                error: expect.any(String),
            }));
        });

        it('should handle partial cache hits correctly', async () => {
            // First text is cached, second is not
            vi.mocked(translationCache.get)
                .mockResolvedValueOnce('Hola')  // 'Hello' is cached
                .mockResolvedValueOnce(null);   // 'World' is not cached

            vi.mocked(callAI).mockResolvedValue(['Mundo']); // API returns translation for 'World'
            vi.mocked(translationCache.set).mockResolvedValue();

            const sendResponse = vi.fn();
            const request = {
                action: 'translateBatch' as const,
                texts: ['Hello', 'World'],
                source: 'English',
                target: 'Spanish',
            };

            handleMessage(request, sendResponse);
            await new Promise(resolve => setTimeout(resolve, 20));

            // Should only call API with uncached text
            expect(callAI).toHaveBeenCalledWith(
                ['World'], // Only uncached texts
                'English',
                'Spanish',
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(String)
            );

            // Should only cache the newly translated text
            expect(translationCache.set).toHaveBeenCalledWith('English', 'Spanish', 'World', 'Mundo');
            expect(translationCache.set).toHaveBeenCalledTimes(1);

            // Final response should merge cached and API results in correct order
            expect(sendResponse).toHaveBeenCalledWith({
                success: true,
                translations: ['Hola', 'Mundo'],
            });
        });
    });

    describe('getCacheStats action', () => {
        it('should return cache stats', async () => {
            const stats = { memoryCount: 5, dbCount: 10, totalCount: 15 };
            vi.mocked(translationCache.getStats).mockResolvedValue(stats);

            const sendResponse = vi.fn();
            handleMessage({ action: 'getCacheStats' }, sendResponse);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(sendResponse).toHaveBeenCalledWith(stats);
        });

        it('should return empty stats on error', async () => {
            vi.mocked(translationCache.getStats).mockRejectedValue(new Error('DB error'));

            const sendResponse = vi.fn();
            handleMessage({ action: 'getCacheStats' }, sendResponse);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(sendResponse).toHaveBeenCalledWith({ memoryCount: 0, dbCount: 0, totalCount: 0 });
        });
    });

    describe('getCacheEntries action', () => {
        it('should return paginated entries', async () => {
            const mockResult = {
                entries: [{ key: '1', source: 'en', target: 'es', originalText: 'hi', translation: 'hola', createdAt: Date.now() }],
                hasMore: false,
                total: 1,
            };
            vi.mocked(translationCache.getEntries).mockResolvedValue(mockResult);

            const sendResponse = vi.fn();
            handleMessage({ action: 'getCacheEntries', page: 0, limit: 20 }, sendResponse);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(translationCache.getEntries).toHaveBeenCalledWith(0, 20);
            expect(sendResponse).toHaveBeenCalledWith(mockResult);
        });
    });

    describe('clearCache action', () => {
        it('should clear cache and return true', async () => {
            vi.mocked(translationCache.clear).mockResolvedValue();

            const sendResponse = vi.fn();
            handleMessage({ action: 'clearCache' }, sendResponse);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(translationCache.clear).toHaveBeenCalled();
            expect(sendResponse).toHaveBeenCalledWith(true);
        });

        it('should return false on error', async () => {
            vi.mocked(translationCache.clear).mockRejectedValue(new Error('Clear failed'));

            const sendResponse = vi.fn();
            handleMessage({ action: 'clearCache' }, sendResponse);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(sendResponse).toHaveBeenCalledWith(false);
        });
    });

    describe('Unknown action', () => {
        it('should return false for unknown action', () => {
            const sendResponse = vi.fn();
            const result = handleMessage({ action: 'unknownAction' } as unknown as MessageRequest, sendResponse);
            expect(result).toBe(false);
        });
    });
});
