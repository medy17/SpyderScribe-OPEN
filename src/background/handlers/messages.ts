/// <reference types="chrome" />

import {
    TranslationError,
    ErrorCode,
    getUserFriendlyMessage
} from '@/lib/errors';
import { callAI } from '../services/translation';
import { translationCache, type CacheStats, type PaginatedCacheResult } from '../services/cache';
export type { CacheStats, PaginatedCacheResult } from '../services/cache';

export interface TranslationRequest {
    action: 'translateBatch';
    texts: string[];
    source: string;
    target: string;
}

export interface TranslationResponse {
    success: boolean;
    translations?: string[];
    error?: string;
    errorCode?: ErrorCode;
}

export interface CacheStatsRequest {
    action: 'getCacheStats';
}

export interface CacheEntriesRequest {
    action: 'getCacheEntries';
    page?: number;
    limit?: number;
}

export interface ClearCacheRequest {
    action: 'clearCache';
}

export type MessageRequest = TranslationRequest | CacheStatsRequest | CacheEntriesRequest | ClearCacheRequest;

export function handleMessage(
    request: MessageRequest,
    sendResponse: (response: TranslationResponse | CacheStats | PaginatedCacheResult | boolean) => void
): boolean {
    if (request.action === 'translateBatch') {
        processBatch(request)
            .then((response) => sendResponse(response))
            .catch((err) => {
                const error = err instanceof TranslationError ? err : new TranslationError(ErrorCode.UNKNOWN_ERROR, err?.message);
                sendResponse({
                    success: false,
                    error: getUserFriendlyMessage(error),
                    errorCode: error.code
                });
            });
        return true; // Async
    }

    if (request.action === 'getCacheStats') {
        translationCache.getStats()
            .then((stats) => sendResponse(stats))
            .catch(() => sendResponse({ memoryCount: 0, dbCount: 0, totalCount: 0 }));
        return true; // Async
    }

    if (request.action === 'getCacheEntries') {
        const page = request.page ?? 0;
        const limit = request.limit ?? 20;
        translationCache.getEntries(page, limit)
            .then((result) => sendResponse(result))
            .catch(() => sendResponse({ entries: [], hasMore: false, total: 0 }));
        return true; // Async
    }

    if (request.action === 'clearCache') {
        translationCache.clear()
            .then(() => sendResponse(true))
            .catch(() => sendResponse(false));
        return true; // Async now
    }

    return false;
}

async function processBatch({ texts, source, target }: { texts: string[]; source: string; target: string }): Promise<TranslationResponse> {
    const result = await chrome.storage.sync.get(['selectedModel', 'geminiApiKey', 'grokApiKey', 'openaiApiKey']);
    const selectedModel = (result.selectedModel as string) || '';
    const geminiApiKey = (result.geminiApiKey as string) || '';
    const grokApiKey = (result.grokApiKey as string) || '';
    const openaiApiKey = (result.openaiApiKey as string) || '';

    // 1. Check Cache & Identify Missing indices
    const results: (string | null)[] = new Array(texts.length).fill(null);
    const missingIndices: number[] = [];
    const textsToTranslate: string[] = [];

    // Check cache for each text (async now)
    await Promise.all(texts.map(async (text, index) => {
        const cached = await translationCache.get(source, target, text);
        if (cached !== null) {
            results[index] = cached;
        } else {
            missingIndices.push(index);
            textsToTranslate.push(text);
        }
    }));

    if (textsToTranslate.length === 0) {
        return { success: true, translations: results as string[] };
    }

    // 2. Call API for missing texts
    try {
        const translatedTexts = await callAI(textsToTranslate, source, target, selectedModel, geminiApiKey, grokApiKey, openaiApiKey);

        // 3. Merge results and update cache
        if (translatedTexts.length !== textsToTranslate.length) {
            throw new TranslationError(
                ErrorCode.RESPONSE_MISMATCH,
                `Sent ${textsToTranslate.length}, got ${translatedTexts.length}`
            );
        }

        // Store translations in cache and results
        await Promise.all(translatedTexts.map(async (trans, i) => {
            const originalIndex = missingIndices[i];
            const originalText = textsToTranslate[i];

            // Cache and Store
            await translationCache.set(source, target, originalText, trans);
            results[originalIndex] = trans;
        }));

        return { success: true, translations: results as string[] };
    } catch (error: unknown) {
        console.error('Translation Error:', error);
        if (error instanceof TranslationError) {
            return { success: false, error: error.userMessage, errorCode: error.code };
        }
        return { success: false, error: getUserFriendlyMessage(error) };
    }
}

// --- Streaming Support ---

import { callAIStream } from '../services/translation';
import { createArrayStreamParser } from '../services/streamParser';

export interface StreamingTranslationRequest {
    action: 'startStreamingTranslation';
    texts: string[];
    source: string;
    target: string;
}

/**
 * Handle port-based streaming translation
 * Messages sent via port:
 * - { type: 'cached', index: number, text: string } - Cached translation
 * - { type: 'element', index: number, text: string } - Streamed translation element
 * - { type: 'complete', translations: string[] } - All done
 * - { type: 'error', error: string, errorCode?: ErrorCode } - Error occurred
 */
export function handleStreamingPort(port: chrome.runtime.Port): void {
    port.onMessage.addListener((request: StreamingTranslationRequest) => {
        if (request.action === 'startStreamingTranslation') {
            processBatchStream(request, port).catch((err) => {
                const error = err instanceof TranslationError ? err : new TranslationError(ErrorCode.UNKNOWN_ERROR, err?.message);
                port.postMessage({
                    type: 'error',
                    error: getUserFriendlyMessage(error),
                    errorCode: error.code
                });
            });
        }
    });
}

async function processBatchStream(
    { texts, source, target }: { texts: string[]; source: string; target: string },
    port: chrome.runtime.Port
): Promise<void> {
    const result = await chrome.storage.sync.get(['selectedModel', 'geminiApiKey', 'grokApiKey', 'openaiApiKey']);
    const selectedModel = (result.selectedModel as string) || '';
    const geminiApiKey = (result.geminiApiKey as string) || '';
    const grokApiKey = (result.grokApiKey as string) || '';
    const openaiApiKey = (result.openaiApiKey as string) || '';

    // Track all results for final response
    const results: (string | null)[] = new Array(texts.length).fill(null);
    const missingIndices: number[] = [];
    const textsToTranslate: string[] = [];

    // 1. Check cache and send cached items immediately
    await Promise.all(texts.map(async (text, index) => {
        const cached = await translationCache.get(source, target, text);
        if (cached !== null) {
            results[index] = cached;
            // Send cached translation immediately
            port.postMessage({ type: 'cached', index, text: cached });
        } else {
            missingIndices.push(index);
            textsToTranslate.push(text);
        }
    }));

    // All cached - we're done
    if (textsToTranslate.length === 0) {
        port.postMessage({ type: 'complete', translations: results as string[] });
        return;
    }

    // 2. Stream translations for missing texts
    let streamedIndex = 0;

    const parser = createArrayStreamParser({
        onElement: (translation: string, parserIndex: number) => {
            // Map parser index to original index
            const originalIndex = missingIndices[parserIndex];
            const originalText = textsToTranslate[parserIndex];

            results[originalIndex] = translation;

            // Send to content script IMMEDIATELY (before any async operations)
            port.postMessage({ type: 'element', index: originalIndex, text: translation });

            // Cache in background - don't await (prevents port disconnect race)
            translationCache.set(source, target, originalText, translation).catch(e => {
                console.error('Cache set failed:', e);
            });

            streamedIndex++;
        },
        onComplete: (elements: string[]) => {
            // Verify we got the right count
            if (elements.length !== textsToTranslate.length) {
                port.postMessage({
                    type: 'error',
                    error: `Expected ${textsToTranslate.length} translations, got ${elements.length}`,
                    errorCode: ErrorCode.RESPONSE_MISMATCH
                });
                return;
            }
            port.postMessage({ type: 'complete', translations: results as string[] });
        },
        onError: (error: Error) => {
            port.postMessage({
                type: 'error',
                error: error.message,
                errorCode: ErrorCode.JSON_PARSE_ERROR
            });
        }
    });

    try {
        await callAIStream(
            textsToTranslate,
            source,
            target,
            selectedModel,
            geminiApiKey,
            grokApiKey,
            openaiApiKey,
            (chunk: string) => {
                parser.feed(chunk);
            }
        );

        // Signal end of stream to parser
        parser.end();
    } catch (error: unknown) {
        console.error('Streaming Translation Error:', error);
        if (error instanceof TranslationError) {
            port.postMessage({ type: 'error', error: error.userMessage, errorCode: error.code });
        } else {
            port.postMessage({ type: 'error', error: getUserFriendlyMessage(error) });
        }
    }
}
