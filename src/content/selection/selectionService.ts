/**
 * Pure logic for handling text selection
 */

const MIN_SELECTION_LENGTH = 2;
const MAX_SELECTION_LENGTH = 5000;

/**
 * Get the currently selected text, if valid
 */
export function getSelectedText(): string | null {
    const selection = window.getSelection();
    if (!selection) return null;

    const text = selection.toString().trim();
    if (text.length < MIN_SELECTION_LENGTH) return null;
    if (text.length > MAX_SELECTION_LENGTH) return null;

    return text;
}

/**
 * Get the bounding rectangle of the current selection
 */
export function getSelectionRect(): DOMRect | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Ensure rect is valid (not collapsed)
    if (rect.width === 0 && rect.height === 0) return null;

    return rect;
}

/**
 * Check if the selection is within an editable element
 */
export function isSelectionEditable(): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const anchorNode = selection.anchorNode;
    if (!anchorNode) return false;

    const element = anchorNode.nodeType === Node.ELEMENT_NODE
        ? anchorNode as Element
        : anchorNode.parentElement;

    if (!element) return false;

    // Check if inside editable context
    if (element.closest('input, textarea, [contenteditable="true"]')) {
        return true;
    }

    return false;
}

/**
 * Check if the selection is within a code block
 */
export function isSelectionInCode(): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const anchorNode = selection.anchorNode;
    if (!anchorNode) return false;

    const element = anchorNode.nodeType === Node.ELEMENT_NODE
        ? anchorNode as Element
        : anchorNode.parentElement;

    if (!element) return false;

    return !!element.closest('code, pre, .highlight, .code');
}
