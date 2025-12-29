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
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        
        .popup-logo svg {
            width: 100%;
            height: 100%;
        }
        
        .popup-title-container {
            display: flex;
            flex-direction: column;
            justify-content: center;
            line-height: 1.2;
        }

        .popup-title {
            font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
            font-size: 13px;
            color: #fff;
            font-weight: 600;
        }

        .popup-subtitle {
            font-size: 10px;
            color: #f38bae;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 4px;
            text-transform: uppercase;
            letter-spacing: 0.02em;
        }

        .popup-dot {
            width: 3px;
            height: 3px;
            background-color: #f38bae;
            border-radius: 50%;
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
            border-top-color: #f38bae;
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
        
            background: #f38bae;
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.1);
        
        .popup-btn-primary:hover {
            opacity: 0.9;
        }
        
            background: #27272a;
            color: #a1a1aa;
            border: 1px solid rgba(255, 255, 255, 0.05);
        
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
            <div className="popup-logo"><svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1387.2 1360.85"><path d="m1060.6 967.11 49-58 115 147s-188.12 292.81-199 300-77.96 12.37-53-33c27.71-50.37 159-261 159-261zm93-169 147 107 15 270s18.55 39.24 53 6 10.13-285.96 12-315-204-143-204-143zm5-230 19 80 203-147-10-317s-28.15-43.32-62 17c10.06 74.73-3 258-3 258zm-103-166 83-108-138-249s-7.49-54.76 51-41 183 296 183 296l-128 158zm-794 319s3.66-408.12 398-413 471.44 278.94 477 373-97.46 328.2-315 378c-45.33 41.03-67.15 132.81-272 161 0 0 59.53-21.16 73-154-130.38-52.92-323.48-73.99-361-345 77.98-82.81 0 0 0 0m-92 336 197 300s47.72 10.94 53-26-156-268-156-268l72-92-49-59zm51-333-205 147 9 305s18.89 37.19 56 10 6-281 6-281l153-97zm19-157-147-98-12-274s-15.48-50.67-60-12-3 315-3 315l196 155zm102-167-83-105 139-245s8.17-70.96-51-44l-188 294 125 164z" style="fill:#f38bae;fill-rule:evenodd"/><path d="m438.94 464.18 214.34-4.71-7.07-80.08 96.57-4.71-2.36 73.02 219.05 11.78-4.71 80.08-75.37 14.13s-30.98 117.56-110.7 216.69c-11.02 13.7 171.94 101.28 171.94 101.28l-49.46 80.08S697.38 861 702.74 838.68 502.54 958.8 502.54 958.8l-44.75-77.73 181.36-98.92-96.57-164.87 84.79-16.49s55.93 110.85 73.02 108.35 77.5-141.13 80.08-155.45-336.81-2.36-336.81-2.36l-4.71-87.15Z" style="fill:#fff;fill-rule:evenodd"/></svg></div>
            <div class="popup-title-container">
                <div class="popup-title">Spyder-Scribe</div>
                <div class="popup-subtitle">
                    <span class="popup-dot"></span>
                    <span>Community Edition</span>
                </div>
            </div>
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
