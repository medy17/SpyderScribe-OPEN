/// <reference types="chrome" />

import type { MessageRequest, TranslationResponse, CacheStats, PaginatedCacheResult } from './handlers/messages';
import { handleMessage, handleStreamingPort } from './handlers/messages';
import { setupContextMenu } from './managers/contextMenu';

// --- Message Handler ---
chrome.runtime.onMessage.addListener(
    (
        request: MessageRequest,
        _: chrome.runtime.MessageSender,
        sendResponse: (response: TranslationResponse | CacheStats | PaginatedCacheResult | boolean) => void
    ) => {
        return handleMessage(request, sendResponse);
    }
);

// --- Streaming Port Handler ---
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'streaming-translation') {
        handleStreamingPort(port);
    }
});

// --- Context Menu ---
setupContextMenu();
