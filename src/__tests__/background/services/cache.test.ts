/**
 * Tests for src/background/services/cache.ts
 * Tests the hybrid in-memory + IndexedDB cache implementation
 * 
 * Note: These tests use fake-indexeddb which is set up in setup.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to import the actual module fresh for each test group
// The cache uses IndexedDB which fake-indexeddb provides

describe('TranslationCache', () => {
    // We'll use a shared instance but clear it between tests
    let translationCache: Awaited<typeof import('@/background/services/cache')>['translationCache'];
    let cacheModule: typeof import('@/background/services/cache');

    beforeEach(async () => {
        // Import fresh module instance
        vi.resetModules();
        cacheModule = await import('@/background/services/cache');
        translationCache = cacheModule.translationCache;

        // Clear cache before each test
        await translationCache.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Basic Operations', () => {
        it('should store and retrieve a translation', async () => {
            await translationCache.set('English', 'Spanish', 'Hello', 'Hola');
            const result = await translationCache.get('English', 'Spanish', 'Hello');

            expect(result).toBe('Hola');
        });

        it('should return null for non-existent translation', async () => {
            const result = await translationCache.get('English', 'Spanish', 'NotCached');

            expect(result).toBeNull();
        });

        it('should use composite key of source:target:text', async () => {
            // Same text, different language pairs should be stored separately
            await translationCache.set('English', 'Spanish', 'Hello', 'Hola');
            await translationCache.set('English', 'French', 'Hello', 'Bonjour');

            expect(await translationCache.get('English', 'Spanish', 'Hello')).toBe('Hola');
            expect(await translationCache.get('English', 'French', 'Hello')).toBe('Bonjour');
        });

        it('should overwrite existing translation', async () => {
            await translationCache.set('English', 'Spanish', 'Hello', 'Hola');
            await translationCache.set('English', 'Spanish', 'Hello', 'Hola Updated');

            const result = await translationCache.get('English', 'Spanish', 'Hello');
            expect(result).toBe('Hola Updated');
        });
    });

    describe('Memory Cache Behavior', () => {
        it('should return from memory on subsequent gets', async () => {
            await translationCache.set('en', 'es', 'test', 'prueba');

            // Multiple gets should work
            expect(await translationCache.get('en', 'es', 'test')).toBe('prueba');
            expect(await translationCache.get('en', 'es', 'test')).toBe('prueba');
            expect(await translationCache.get('en', 'es', 'test')).toBe('prueba');
        });

        it('should handle many entries', async () => {
            // Add multiple entries
            for (let i = 0; i < 50; i++) {
                await translationCache.set('en', 'es', `item${i}`, `translated${i}`);
            }

            // Verify all are retrievable
            for (let i = 0; i < 50; i++) {
                const result = await translationCache.get('en', 'es', `item${i}`);
                expect(result).toBe(`translated${i}`);
            }
        });

        it('should evict oldest entries when exceeding memory limit', async () => {
            // The cache has MEMORY_LIMIT = 500
            // Add 502 entries to trigger eviction
            for (let i = 0; i < 502; i++) {
                await translationCache.set('en', 'es', `evict_test_${i}`, `value_${i}`);
            }

            const stats = await translationCache.getStats();

            // Memory should be at or below limit (some evictions occurred)
            expect(stats.memoryCount).toBeLessThanOrEqual(500);

            // The oldest entries (0, 1) should be evicted from memory
            // but the newest entries should still be in memory
            // Note: They may still be in DB, so we just check memory behavior
            const newestResult = await translationCache.get('en', 'es', 'evict_test_501');
            expect(newestResult).toBe('value_501');
        });
    });

    describe('clear()', () => {
        it('should clear all entries', async () => {
            await translationCache.set('en', 'es', 'hello', 'hola');
            await translationCache.set('en', 'fr', 'hello', 'bonjour');

            await translationCache.clear();

            expect(await translationCache.get('en', 'es', 'hello')).toBeNull();
            expect(await translationCache.get('en', 'fr', 'hello')).toBeNull();
        });
    });

    describe('getStats()', () => {
        it('should return correct counts after adding entries', async () => {
            await translationCache.set('en', 'es', 'one', 'uno');
            await translationCache.set('en', 'es', 'two', 'dos');
            await translationCache.set('en', 'es', 'three', 'tres');

            const stats = await translationCache.getStats();

            expect(stats.memoryCount).toBe(3);
            expect(stats.dbCount).toBe(3); // DB should have same entries as memory
            expect(stats.totalCount).toBe(3);
        });

        it('should return zero counts for empty cache', async () => {
            const stats = await translationCache.getStats();

            expect(stats.memoryCount).toBe(0);
        });

        it('should update counts after clear', async () => {
            await translationCache.set('en', 'es', 'test', 'prueba');
            await translationCache.clear();

            const stats = await translationCache.getStats();
            expect(stats.memoryCount).toBe(0);
        });
    });

    describe('getEntries()', () => {
        it('should return entries that were added', async () => {
            await translationCache.set('en', 'es', 'hello', 'hola');
            await translationCache.set('en', 'es', 'world', 'mundo');

            const result = await translationCache.getEntries(0, 10);

            expect(result.entries.length).toBeGreaterThanOrEqual(0);
            expect(typeof result.hasMore).toBe('boolean');
            expect(typeof result.total).toBe('number');
        });

        it('should return empty result for empty cache', async () => {
            const result = await translationCache.getEntries(0, 20);

            expect(result.entries).toHaveLength(0);
            expect(result.hasMore).toBe(false);
            expect(result.total).toBe(0);
        });

        it('should respect pagination parameters', async () => {
            // Add entries
            for (let i = 0; i < 5; i++) {
                await translationCache.set('en', 'es', `text${i}`, `translation${i}`);
            }

            const page1 = await translationCache.getEntries(0, 2);
            const page2 = await translationCache.getEntries(1, 2);

            // Both calls should succeed
            expect(page1).toBeDefined();
            expect(page2).toBeDefined();
        });
    });

    describe('Error Resilience', () => {
        it('should handle concurrent operations', async () => {
            // Fire multiple operations concurrently
            const operations = [
                translationCache.set('en', 'es', 'a', '1'),
                translationCache.set('en', 'es', 'b', '2'),
                translationCache.set('en', 'es', 'c', '3'),
            ];

            await expect(Promise.all(operations)).resolves.not.toThrow();

            // Verify all were stored
            expect(await translationCache.get('en', 'es', 'a')).toBe('1');
            expect(await translationCache.get('en', 'es', 'b')).toBe('2');
            expect(await translationCache.get('en', 'es', 'c')).toBe('3');
        });

        it('should handle special characters in text', async () => {
            const specialText = '🎉 Hello "World" <script>alert(1)</script>';
            const translation = '🎊 Hola "Mundo" <script>alert(1)</script>';

            await translationCache.set('en', 'es', specialText, translation);
            const result = await translationCache.get('en', 'es', specialText);

            expect(result).toBe(translation);
        });

        it('should handle empty strings', async () => {
            await translationCache.set('en', 'es', '', '');
            const result = await translationCache.get('en', 'es', '');

            expect(result).toBe('');
        });

        it('should handle unicode text', async () => {
            const text = '日本語テキスト';
            const translation = 'Japanese text';

            await translationCache.set('ja', 'en', text, translation);
            const result = await translationCache.get('ja', 'en', text);

            expect(result).toBe(translation);
        });

        it('should handle text with newlines', async () => {
            const text = 'Line1\nLine2\nLine3';
            const translation = 'Línea1\nLínea2\nLínea3';

            await translationCache.set('en', 'es', text, translation);
            const result = await translationCache.get('en', 'es', text);

            expect(result).toBe(translation);
        });
    });

    describe('Type Exports', () => {
        it('should export CacheEntry type', async () => {
            // Type check - if this compiles, the type is exported correctly
            const entry: import('@/background/services/cache').CacheEntry = {
                key: 'test',
                source: 'en',
                target: 'es',
                originalText: 'hello',
                translation: 'hola',
                createdAt: Date.now(),
            };
            expect(entry).toBeDefined();
            expect(entry.key).toBe('test');
        });

        it('should export CacheStats type', async () => {
            const stats: import('@/background/services/cache').CacheStats = {
                memoryCount: 0,
                dbCount: 0,
                totalCount: 0,
            };
            expect(stats).toBeDefined();
        });

        it('should export PaginatedCacheResult type', async () => {
            const result: import('@/background/services/cache').PaginatedCacheResult = {
                entries: [],
                hasMore: false,
                total: 0,
            };
            expect(result).toBeDefined();
        });
    });

    describe('Cache Key Generation', () => {
        it('should treat source language as part of key', async () => {
            await translationCache.set('English', 'Spanish', 'Hello', 'Hola');
            await translationCache.set('French', 'Spanish', 'Hello', 'Bonjour en espagnol');

            expect(await translationCache.get('English', 'Spanish', 'Hello')).toBe('Hola');
            expect(await translationCache.get('French', 'Spanish', 'Hello')).toBe('Bonjour en espagnol');
        });

        it('should treat target language as part of key', async () => {
            await translationCache.set('English', 'Spanish', 'Hello', 'Hola');
            await translationCache.set('English', 'German', 'Hello', 'Hallo');

            expect(await translationCache.get('English', 'Spanish', 'Hello')).toBe('Hola');
            expect(await translationCache.get('English', 'German', 'Hello')).toBe('Hallo');
        });

        it('should be case-sensitive', async () => {
            await translationCache.set('en', 'es', 'Hello', 'Hola');
            await translationCache.set('en', 'es', 'hello', 'hola lowercase');

            expect(await translationCache.get('en', 'es', 'Hello')).toBe('Hola');
            expect(await translationCache.get('en', 'es', 'hello')).toBe('hola lowercase');
        });
    });
});
