/// <reference types="chrome" />

import { getUserFriendlyMessage } from '@/lib/errors';

const POPUP_ID = 'spider-scribe-selection-popup';

interface PopupState {
    host: HTMLElement | null;
    shadow: ShadowRoot | null;
}

const state: PopupState = {
    host: null,
    shadow: null,
};

/**
 * Get the CSS for the popup (isolated in Shadow DOM)
 */
function getPopupStyles(): string {
    return `
        
        :host {
            all: initial;
            font-family: 'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: #fff;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
        }
        
        *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        .popup-container {
            position: fixed;
            z-index: 2147483647;
            background: #18181b;
            border: 1px solid #3f3f46;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            padding: 12px 16px;
            max-width: 320px;
            min-width: 180px;
            min-height: 150px;
            max-height: 400px;
            color: #fff;
            font-size: 14px;
            line-height: 1.5;
            animation: fadeIn 0.15s ease-out;
            display: flex;
            flex-direction: column;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .popup-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid #27272a;
            cursor: grab;
            user-select: none;
        }
        
        .popup-header:active {
            cursor: grabbing;
        }
        
        .popup-logo {
            width: 20px;
            height: 20px;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899);
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 11px;
        }
        
        .popup-title {
            font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
            font-size: 12px;
            color: #a1a1aa;
            font-weight: 500;
        }
        
        .popup-close {
            margin-left: auto;
            background: transparent;
            border: none;
            color: #71717a;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .popup-close:hover {
            background: #27272a;
            color: #fff;
        }
        
        .popup-content {
            color: #e4e4e7;
            flex: 1;
            overflow-y: auto;
            min-height: 0;
        }
        
        .popup-content::-webkit-scrollbar {
            width: 6px;
        }
        
        .popup-content::-webkit-scrollbar-track {
            background: #27272a;
            border-radius: 3px;
        }
        
        .popup-content::-webkit-scrollbar-thumb {
            background: #52525b;
            border-radius: 3px;
        }
        
        .popup-content::-webkit-scrollbar-thumb:hover {
            background: #71717a;
        }
        
        .popup-loading {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #a1a1aa;
        }
        
        .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid #3f3f46;
            border-top-color: #8b5cf6;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .popup-actions {
            display: flex;
            gap: 8px;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #27272a;
            flex-shrink: 0;
        }
        
        .popup-btn {
            flex: 1;
            padding: 6px 12px;
            border: none;
            border-radius: 6px;
            font-family: inherit;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s;
        }
        
        .popup-btn-primary {
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            color: white;
        }
        
        .popup-btn-primary:hover {
            opacity: 0.9;
        }
        
        .popup-btn-secondary {
            background: #27272a;
            color: #a1a1aa;
        }
        
        .popup-btn-secondary:hover {
            background: #3f3f46;
            color: #fff;
        }
        
        .popup-error {
            color: #f87171;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .popup-original {
            font-size: 11px;
            color: #71717a;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px dashed #27272a;
        }
        
        .popup-original-label {
            font-weight: 500;
            margin-bottom: 2px;
        }
        
        .popup-resize-handle {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 16px;
            height: 16px;
            cursor: se-resize;
            opacity: 0.5;
            transition: opacity 0.15s;
        }
        
        .popup-resize-handle:hover {
            opacity: 1;
        }
        
        .popup-resize-handle::before,
        .popup-resize-handle::after {
            content: '';
            position: absolute;
            background: #52525b;
        }
        
        .popup-resize-handle::before {
            width: 8px;
            height: 2px;
            bottom: 4px;
            right: 4px;
            transform: rotate(-45deg);
        }
        
        .popup-resize-handle::after {
            width: 4px;
            height: 2px;
            bottom: 7px;
            right: 4px;
            transform: rotate(-45deg);
        }
    `;
}

/**
 * Inject Google Fonts into document head (needed for Shadow DOM to access fonts)
 */
function injectFonts(): void {
    const FONT_LINK_ID = 'spider-scribe-fonts';
    if (document.getElementById(FONT_LINK_ID)) return;

    const link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Space+Grotesk:wght@500;700&display=swap';
    document.head.appendChild(link);
}

/**
 * Create and show the popup at a given position
 */
export function showPopup(x: number, y: number): void {
    hidePopup(); // Remove any existing popup
    injectFonts(); // Ensure fonts are loaded

    // Create host element
    const host = document.createElement('div');
    host.id = POPUP_ID;

    // Attach shadow DOM (closed for complete isolation)
    const shadow = host.attachShadow({ mode: 'closed' });

    // Add styles
    const style = document.createElement('style');
    style.textContent = getPopupStyles();
    shadow.appendChild(style);

    // Create popup container
    const container = document.createElement('div');
    container.className = 'popup-container';

    // Position popup
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust position to stay within viewport
    const left = x;
    const top = y + 10; // 10px below cursor

    // Will adjust after measuring, for now set initial position
    container.style.left = `${Math.min(left, viewportWidth - 350)}px`;
    container.style.top = `${Math.min(top, viewportHeight - 200)}px`;

    container.innerHTML = `
        <div class="popup-header">
            <div class="popup-logo">S</div>
            <span class="popup-title">Spyder-Scribe</span>
            <button class="popup-close" aria-label="Close">✕</button>
        </div>
        <div class="popup-content">
            <div class="popup-loading">
                <div class="spinner"></div>
                <span>Translating...</span>
            </div>
        </div>
        <div class="popup-actions" style="display: none;"></div>
        <div class="popup-resize-handle"></div>
    `;

    shadow.appendChild(container);
    document.body.appendChild(host);

    // Store references
    state.host = host;
    state.shadow = shadow;

    // Add close handler
    const closeBtn = shadow.querySelector('.popup-close');
    closeBtn?.addEventListener('click', hidePopup);

    // Add drag handler
    const header = shadow.querySelector('.popup-header') as HTMLElement;
    if (header) {
        setupDrag(header, container);
    }

    // Add resize handler
    const resizeHandle = shadow.querySelector('.popup-resize-handle') as HTMLElement;
    if (resizeHandle) {
        setupResize(resizeHandle, container);
    }

    // Close on click outside
    setTimeout(() => {
        document.addEventListener('mousedown', handleOutsideClick);
    }, 100);
}

/**
 * Update popup with translation result
 */
export function updatePopupWithTranslation(originalText: string, translatedText: string): void {
    if (!state.shadow) return;

    const content = state.shadow.querySelector('.popup-content');
    const actions = state.shadow.querySelector('.popup-actions') as HTMLElement;
    if (!content || !actions) return;

    // Update content (scrollable area)
    content.innerHTML = `
        <div class="popup-translation">${escapeHtml(translatedText)}</div>
        <div class="popup-original">
            <div class="popup-original-label">Original:</div>
            <div>${escapeHtml(originalText.substring(0, 100))}${originalText.length > 100 ? '...' : ''}</div>
        </div>
    `;

    // Update actions (fixed at bottom)
    actions.innerHTML = `
        <button class="popup-btn popup-btn-primary" data-action="copy">Copy</button>
        <button class="popup-btn popup-btn-secondary" data-action="close">Close</button>
    `;
    actions.style.display = 'flex';

    // Add action handlers
    const copyBtn = actions.querySelector('[data-action="copy"]');
    const closeBtn = actions.querySelector('[data-action="close"]');

    copyBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(translatedText);
        if (copyBtn instanceof HTMLElement) {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = 'Copy';
            }, 1500);
        }
    });

    closeBtn?.addEventListener('click', hidePopup);
}

/**
 * Update popup with error
 */
export function updatePopupWithError(error: unknown): void {
    if (!state.shadow) return;

    const content = state.shadow.querySelector('.popup-content');
    const actions = state.shadow.querySelector('.popup-actions') as HTMLElement;
    if (!content || !actions) return;

    const message = getUserFriendlyMessage(error);

    content.innerHTML = `
        <div class="popup-error">
            <span>⚠️</span>
            <span>${escapeHtml(message)}</span>
        </div>
    `;

    actions.innerHTML = `
        <button class="popup-btn popup-btn-secondary" data-action="close">Close</button>
    `;
    actions.style.display = 'flex';

    const closeBtn = actions.querySelector('[data-action="close"]');
    closeBtn?.addEventListener('click', hidePopup);
}

/**
 * Hide and remove the popup
 */
export function hidePopup(): void {
    if (state.host) {
        state.host.remove();
        state.host = null;
        state.shadow = null;
    }
    document.removeEventListener('mousedown', handleOutsideClick);
}

/**
 * Check if popup is currently visible
 */
export function isPopupVisible(): boolean {
    return state.host !== null;
}

/**
 * Handle clicks outside the popup
 */
function handleOutsideClick(e: MouseEvent): void {
    if (!state.host) return;

    // Check if click is outside popup
    const path = e.composedPath();
    if (!path.includes(state.host)) {
        hidePopup();
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Setup drag functionality for the popup
 */
function setupDrag(dragHandle: HTMLElement, container: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    dragHandle.addEventListener('mousedown', (e: MouseEvent) => {
        // Don't drag if clicking on close button
        if ((e.target as HTMLElement).closest('.popup-close')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseInt(container.style.left) || 0;
        initialTop = parseInt(container.style.top) || 0;

        e.preventDefault();
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        container.style.left = `${initialLeft + deltaX}px`;
        container.style.top = `${initialTop + deltaY}px`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

/**
 * Setup resize functionality for the popup
 */
function setupResize(resizeHandle: HTMLElement, container: HTMLElement): void {
    let isResizing = false;
    let startX = 0;
    let startY = 0;
    let initialWidth = 0;
    let initialHeight = 0;

    resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        initialWidth = container.offsetWidth;
        initialHeight = container.offsetHeight;

        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        const newWidth = Math.max(200, initialWidth + deltaX);
        const newHeight = Math.max(150, initialHeight + deltaY);

        container.style.width = `${newWidth}px`;
        container.style.height = `${newHeight}px`;
        container.style.maxWidth = 'none';
        container.style.maxHeight = 'none';
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
    });
}
