/// <reference types="chrome" />

/**
 * TranslationCache - Hybrid in-memory + IndexedDB cache for translations
 * 
 * Architecture:
 * - Hot tier: In-memory LRU Map (~500 items) for instant lookups
 * - Cold tier: IndexedDB for persistence across service worker restarts
 * - On hit from DB: promotes to memory for LRU behavior
 */

const DB_NAME = 'SpiderScribeCache';
const DB_VERSION = 1;
const STORE_NAME = 'translations';
const MEMORY_LIMIT = 500;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CacheEntry {
    key: string;
    source: string;
    target: string;
    originalText: string;
    translation: string;
    createdAt: number;
}

export interface CacheStats {
    memoryCount: number;
    dbCount: number;
    totalCount: number;
}

export interface PaginatedCacheResult {
    entries: CacheEntry[];
    hasMore: boolean;
    total: number;
}

class TranslationCache {
    private memoryCache: Map<string, string> = new Map();
    private db: IDBDatabase | null = null;
    private dbReady: Promise<void>;

    constructor() {
        this.dbReady = this.initDB();
    }

    private initDB(): Promise<void> {
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                this.cleanExpired(); // Clean old entries on startup
                resolve();
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
                resolve(); // Continue without DB - fallback to memory only
            };
        });
    }

    /**
     * Get a translation from cache
     * Checks memory first, then IndexedDB
     */
    async get(source: string, target: string, text: string): Promise<string | null> {
        const key = this.makeKey(source, target, text);

        // Check memory first (hot path)
        if (this.memoryCache.has(key)) {
            // LRU: move to end
            const value = this.memoryCache.get(key)!;
            this.memoryCache.delete(key);
            this.memoryCache.set(key, value);
            return value;
        }

        // Check IndexedDB (cold path)
        await this.dbReady;
        if (!this.db) return null;

        return new Promise((resolve) => {
            const tx = this.db!.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => {
                const entry = request.result as CacheEntry | undefined;
                if (entry) {
                    // Check TTL
                    if (Date.now() - entry.createdAt > TTL_MS) {
                        this.deleteFromDB(key);
                        resolve(null);
                        return;
                    }
                    // Promote to memory (LRU)
                    this.addToMemory(key, entry.translation);
                    resolve(entry.translation);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => resolve(null);
        });
    }

    /**
     * Store a translation in cache (both memory and IndexedDB)
     */
    async set(source: string, target: string, text: string, translation: string): Promise<void> {
        const key = this.makeKey(source, target, text);

        // Add to memory
        this.addToMemory(key, translation);

        // Add to IndexedDB
        await this.dbReady;
        if (!this.db) return;

        const entry: CacheEntry = {
            key,
            source,
            target,
            originalText: text,
            translation,
            createdAt: Date.now()
        };

        return new Promise((resolve) => {
            const tx = this.db!.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(entry);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve(); // Fail silently
        });
    }

    /**
     * Clear all cache (memory + IndexedDB)
     */
    async clear(): Promise<void> {
        this.memoryCache.clear();

        await this.dbReady;
        if (!this.db) return;

        return new Promise((resolve) => {
            const tx = this.db!.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    }

    /**
     * Get cache statistics
     */
    async getStats(): Promise<CacheStats> {
        await this.dbReady;

        const memoryCount = this.memoryCache.size;
        let dbCount = 0;

        if (this.db) {
            dbCount = await new Promise<number>((resolve) => {
                const tx = this.db!.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.count();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(0);
            });
        }

        return {
            memoryCount,
            dbCount,
            totalCount: dbCount // DB is source of truth for total
        };
    }

    /**
     * Get paginated cache entries for debugging UI
     */
    async getEntries(page: number = 0, limit: number = 20): Promise<PaginatedCacheResult> {
        await this.dbReady;
        if (!this.db) {
            return { entries: [], hasMore: false, total: 0 };
        }

        return new Promise((resolve) => {
            const tx = this.db!.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('createdAt');

            const entries: CacheEntry[] = [];
            let skipped = 0;
            const skip = page * limit;
            let total = 0;

            // Get total count
            const countRequest = store.count();
            countRequest.onsuccess = () => {
                total = countRequest.result;
            };

            // Iterate in reverse order (newest first)
            const cursorRequest = index.openCursor(null, 'prev');

            cursorRequest.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

                if (cursor) {
                    if (skipped < skip) {
                        skipped++;
                        cursor.continue();
                        return;
                    }

                    if (entries.length < limit) {
                        entries.push(cursor.value as CacheEntry);
                        cursor.continue();
                        return;
                    }
                }

                resolve({
                    entries,
                    hasMore: (page + 1) * limit < total,
                    total
                });
            };

            cursorRequest.onerror = () => {
                resolve({ entries: [], hasMore: false, total: 0 });
            };
        });
    }

    // --- Private helpers ---

    private makeKey(source: string, target: string, text: string): string {
        return `${source}:${target}:${text}`;
    }

    private addToMemory(key: string, value: string): void {
        // LRU: delete if exists (will be re-added at end)
        this.memoryCache.delete(key);
        this.memoryCache.set(key, value);

        // Prune if over limit
        if (this.memoryCache.size > MEMORY_LIMIT) {
            const firstKey = this.memoryCache.keys().next().value;
            if (firstKey) this.memoryCache.delete(firstKey);
        }
    }

    private async deleteFromDB(key: string): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve) => {
            const tx = this.db!.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    }

    private async cleanExpired(): Promise<void> {
        if (!this.db) return;

        const cutoff = Date.now() - TTL_MS;

        return new Promise((resolve) => {
            const tx = this.db!.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('createdAt');

            const range = IDBKeyRange.upperBound(cutoff);
            const cursorRequest = index.openCursor(range);

            cursorRequest.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            cursorRequest.onerror = () => resolve();
        });
    }
}

// Singleton export
export const translationCache = new TranslationCache();
