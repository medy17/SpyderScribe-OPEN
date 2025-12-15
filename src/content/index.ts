/// <reference types="chrome" />

import { getUserFriendlyMessage } from '@/lib/errors';
import { isBlacklisted } from './selection/blacklist';
import { getSelectedText, getSelectionRect, isSelectionEditable, isSelectionInCode } from './selection/selectionService';
import { showPopup, updatePopupWithTranslation, updatePopupWithError, isPopupVisible } from './selection/SelectionPopup';

// --- Configuration & State ---
const BATCH_CHAR_LIMIT = 2000;
let isProcessing = false;

// --- UI Helpers ---
function createOverlay(msg: string, isError = false): HTMLElement {
    let el = document.getElementById('spider-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'spider-overlay';
        document.body.appendChild(el);
    }

    const bgColor = isError ? '#dc2626' : '#1e293b';
    const borderColor = isError ? '#ef4444' : '#334155';

    el.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 999999;
        background: ${bgColor}; color: white; padding: 12px 20px;
        border-radius: 8px; font-family: sans-serif; font-size: 14px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 1px solid ${borderColor};
        display: flex; align-items: center; gap: 10px; transition: opacity 0.3s;
        max-width: 350px;
    `;

    if (isError) {
        el.innerHTML = `<span style="font-size: 16px;">⚠️</span> <span>${msg}</span>`;
    } else {
        el.innerHTML = `<div style="width:16px;height:16px;border:2px solid white;border-bottom-color:transparent;border-radius:50%;animation:spiderSpin 1s linear infinite"></div> <span>${msg}</span>`;
    }

    if (!document.getElementById('spider-styles')) {
        const s = document.createElement('style');
        s.id = 'spider-styles';
        s.innerHTML = `@keyframes spiderSpin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} } .spider-trans-highlight:hover { background: rgba(255, 255, 0, 0.2); }`;
        document.head.appendChild(s);
    }
    return el;
}

function showError(msg: string) {
    createOverlay(msg, true);
    setTimeout(removeOverlay, 5000);
}

function removeOverlay() {
    const el = document.getElementById('spider-overlay');
    if (el) el.remove();
}

// --- Core Translation Engine ---
async function runFullPageTranslation(source: string, target: string) {
    if (isProcessing) return;
    isProcessing = true;
    const overlay = createOverlay('Scanning page...');

    try {
        // 1. Collect Text Nodes
        const textNodes: Node[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;

                // Filters
                if (parent.id === 'spider-overlay' || parent.closest('#spider-overlay')) return NodeFilter.FILTER_REJECT;

                const tag = parent.tagName.toLowerCase();
                if (['script', 'style', 'noscript', 'textarea', 'input', 'code', 'pre'].includes(tag))
                    return NodeFilter.FILTER_REJECT;
                if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
                if (parent.getAttribute('translate') === 'no') return NodeFilter.FILTER_REJECT;
                if ((node.textContent?.trim().length ?? 0) < 2) return NodeFilter.FILTER_REJECT;
                if (parent.classList.contains('spider-translated')) return NodeFilter.FILTER_REJECT;

                return NodeFilter.FILTER_ACCEPT;
            },
        });

        while (walker.nextNode()) textNodes.push(walker.currentNode);

        if (textNodes.length === 0) {
            overlay.innerHTML = 'No text found.';
            setTimeout(removeOverlay, 2000);
            isProcessing = false;
            return;
        }

        // 2. Batching Logic
        interface BatchItem {
            node: Node;
            text: string;
        }
        let currentBatchNodes: BatchItem[] = [];
        let currentCharCount = 0;
        let failedBatches = 0;
        let successfulBatches = 0;

        for (let i = 0; i < textNodes.length; i++) {
            const node = textNodes[i];
            const text = node.textContent?.trim() || '';

            currentBatchNodes.push({ node, text });
            currentCharCount += text.length;

            if (currentCharCount >= BATCH_CHAR_LIMIT || i === textNodes.length - 1) {
                overlay.innerHTML = `Translating... (${Math.round((i / textNodes.length) * 100)}%)`;

                const texts = currentBatchNodes.map((item) => item.text);
                try {
                    const response = await chrome.runtime.sendMessage({
                        action: 'translateBatch',
                        texts,
                        source,
                        target,
                    });

                    if (response?.success) {
                        applyTranslations(currentBatchNodes, response.translations);
                        successfulBatches++;
                    } else {
                        console.error('Batch failed:', response?.error);
                        failedBatches++;
                        // Show error on first failure
                        if (failedBatches === 1 && response?.error) {
                            overlay.innerHTML = `⚠️ ${response.error}`;
                        }
                    }
                } catch (e) {
                    console.error('Message error:', e);
                    failedBatches++;
                    if (failedBatches === 1) {
                        const errorMsg = getUserFriendlyMessage(e);
                        overlay.innerHTML = `⚠️ ${errorMsg}`;
                    }
                }

                currentBatchNodes = [];
                currentCharCount = 0;
            }
        }

        // Show completion status
        if (failedBatches > 0 && successfulBatches === 0) {
            showError('Translation failed. Check your API key in Settings.');
        } else if (failedBatches > 0) {
            overlay.innerHTML = `Partially complete (${failedBatches} batches failed)`;
            setTimeout(removeOverlay, 4000);
        } else {
            overlay.innerHTML = 'Translation Complete!';
            setTimeout(removeOverlay, 3000);
        }
    } catch (error) {
        console.error('Translation error:', error);
        showError(getUserFriendlyMessage(error));
    } finally {
        isProcessing = false;
    }
}

function applyTranslations(nodeItems: { node: Node; text: string }[], translatedTexts: string[]) {
    nodeItems.forEach((item, index) => {
        const translation = translatedTexts[index];
        if (!translation || translation === item.text) return;

        const span = document.createElement('span');
        span.className = 'spider-translated spider-trans-highlight';
        span.textContent = translation;
        span.title = `Original: ${item.text}`;
        span.dataset.original = item.text;
        span.style.cursor = 'help';

        span.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (span.textContent === translation) {
                span.textContent = item.text;
                span.style.opacity = '0.6';
            } else {
                span.textContent = translation;
                span.style.opacity = '1';
            }
        };

        if (item.node.parentNode) {
            item.node.parentNode.replaceChild(span, item.node);
        }
    });
}

function revertTranslations() {
    const els = document.querySelectorAll('.spider-translated') as NodeListOf<HTMLElement>;
    els.forEach((el) => {
        if (el.dataset.original) {
            const txt = document.createTextNode(el.dataset.original);
            el.parentNode?.replaceChild(txt, el);
        }
    });
    createOverlay(`Reverted ${els.length} elements.`);
    setTimeout(removeOverlay, 2000);
}

/**
 * Translate selected text and show result in Shadow DOM popup
 */
async function translateSelectionWithPopup(text: string, x: number, y: number) {
    showPopup(x, y);

    try {
        const settings = await chrome.storage.sync.get(['sourceLang', 'targetLang']);

        const response = await chrome.runtime.sendMessage({
            action: 'translateBatch',
            texts: [text],
            source: settings.sourceLang || 'Auto-detect',
            target: settings.targetLang || 'English',
        });

        if (response?.success && response.translations?.[0]) {
            updatePopupWithTranslation(text, response.translations[0]);
        } else {
            updatePopupWithError(response?.error || 'Translation failed');
        }
    } catch (error) {
        console.error('Selection translation error:', error);
        updatePopupWithError(error);
    }
}

// Track selection state for debouncing
let selectionDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastSelectionText = '';

/**
 * Handle mouseup event for selection-based translation
 * Uses smart debouncing to handle triple-click paragraph selection
 */
async function handleSelectionMouseUp() {
    // Skip if popup is already visible
    if (isPopupVisible()) return;

    // Clear any pending debounce
    if (selectionDebounceTimer) {
        clearTimeout(selectionDebounceTimer);
        selectionDebounceTimer = null;
    }

    // Get initial selection
    let currentText = getSelectedText();
    if (!currentText) return;

    lastSelectionText = currentText;

    // Wait for selection to stabilize (handles double/triple click)
    // Poll for 400ms total, checking every 100ms if selection changed
    for (let i = 0; i < 4; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));

        const newText = getSelectedText();
        if (!newText) return; // Selection was cleared

        if (newText !== lastSelectionText) {
            // Selection changed (user is still clicking), update and continue waiting
            lastSelectionText = newText;
            currentText = newText;
        }
    }

    // Final check - selection should be stable now
    const finalText = getSelectedText();
    if (!finalText || finalText !== currentText) return;

    // Check blacklist
    const hostname = window.location.hostname;
    if (await isBlacklisted(hostname)) return;

    // Check if popup is enabled in settings
    const settings = await chrome.storage.sync.get(['selectionPopupEnabled']);
    if (settings.selectionPopupEnabled === false) return;

    // Skip editable content and code blocks
    if (isSelectionEditable()) return;
    if (isSelectionInCode()) return;

    // Get position
    const rect = getSelectionRect();
    if (!rect) return;

    // Show popup near selection
    const x = rect.left + window.scrollX;
    const y = rect.bottom + window.scrollY;

    translateSelectionWithPopup(finalText, x, y);
}

/**
 * Legacy: Translate selection inline (for context menu fallback)
 */
async function translateCurrentSelection() {
    const sel = window.getSelection();
    if (!sel?.toString().trim()) return;

    const text = sel.toString().trim();
    const range = sel.getRangeAt(0);

    const loader = document.createElement('span');
    loader.textContent = ' [Translating...] ';
    loader.style.color = '#3b82f6';
    range.deleteContents();
    range.insertNode(loader);

    try {
        const settings = await chrome.storage.sync.get(['sourceLang', 'targetLang']);

        const response = await chrome.runtime.sendMessage({
            action: 'translateBatch',
            texts: [text],
            source: settings.sourceLang || 'Auto-detect',
            target: settings.targetLang || 'English',
        });

        if (response?.success && response.translations?.[0]) {
            const span = document.createElement('span');
            span.className = 'spider-translated';
            span.textContent = response.translations[0];
            span.title = 'Original: ' + text;
            span.dataset.original = text;
            span.style.borderBottom = '2px dotted #3b82f6';
            span.onclick = function () {
                const el = this as HTMLElement;
                el.textContent = el.textContent === text ? response.translations[0] : text;
            };
            loader.replaceWith(span);
        } else {
            // Show inline error
            loader.textContent = text;
            loader.style.color = '#ef4444';
            loader.title = response?.error || 'Translation failed';

            // Flash error briefly
            setTimeout(() => {
                loader.style.color = 'inherit';
                loader.title = '';
            }, 3000);
        }
    } catch (error) {
        console.error('Selection translation error:', error);
        loader.textContent = text;
        loader.style.color = '#ef4444';
        loader.title = getUserFriendlyMessage(error);

        setTimeout(() => {
            loader.style.color = 'inherit';
            loader.title = '';
        }, 3000);
    }
}

// Ensure the listener is added only once
const win = window as Window & { hasSpiderTranslator?: boolean };
if (!win.hasSpiderTranslator) {
    win.hasSpiderTranslator = true;

    // Message listener
    chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
        if (msg.action === 'ping') return sendResponse(true);
        if (msg.action === 'translate') runFullPageTranslation(msg.source, msg.target);
        else if (msg.action === 'revert') revertTranslations();
        else if (msg.action === 'translateSelection') translateCurrentSelection();
    });

    // Selection popup listener
    document.addEventListener('mouseup', handleSelectionMouseUp);
}

