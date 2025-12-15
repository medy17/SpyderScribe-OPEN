/**
 * Tests for src/content/selection/selectionService.ts
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
    getSelectedText,
    getSelectionRect,
    isSelectionEditable,
    isSelectionInCode,
} from '@/content/selection/selectionService';

describe('selectionService', () => {
    beforeEach(() => {
        // Clear any existing selection
        window.getSelection()?.removeAllRanges();
    });

    describe('getSelectedText', () => {
        it('should return null when no selection', () => {
            vi.spyOn(window, 'getSelection').mockReturnValue(null);

            const result = getSelectedText();
            expect(result).toBeNull();
        });

        it('should return null for empty selection', () => {
            const mockSelection = {
                toString: () => '   ',
            } as Selection;
            vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

            const result = getSelectedText();
            expect(result).toBeNull();
        });

        it('should return null for selection less than 2 characters', () => {
            const mockSelection = {
                toString: () => 'a',
            } as Selection;
            vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

            const result = getSelectedText();
            expect(result).toBeNull();
        });

        it('should return trimmed text for valid selection', () => {
            const mockSelection = {
                toString: () => '  Hello World  ',
            } as Selection;
            vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

            const result = getSelectedText();
            expect(result).toBe('Hello World');
        });

        it('should return null for text exceeding max length', () => {
            const longText = 'a'.repeat(5001);
            const mockSelection = {
                toString: () => longText,
            } as Selection;
            vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

            const result = getSelectedText();
            expect(result).toBeNull();
        });
    });

    describe('getSelectionRect', () => {
        it('should return null when no selection', () => {
            vi.spyOn(window, 'getSelection').mockReturnValue(null);

            const result = getSelectionRect();
            expect(result).toBeNull();
        });

        it('should return null when no ranges', () => {
            const mockSelection = {
                rangeCount: 0,
            } as Selection;
            vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

            const result = getSelectionRect();
            expect(result).toBeNull();
        });

        it('should return null for collapsed rect', () => {
            const mockRect = { width: 0, height: 0 } as DOMRect;
            const mockRange = {
                getBoundingClientRect: () => mockRect,
            } as Range;
            const mockSelection = {
                rangeCount: 1,
                getRangeAt: () => mockRange,
            } as unknown as Selection;
            vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

            const result = getSelectionRect();
            expect(result).toBeNull();
        });

        it('should return rect for valid selection', () => {
            const mockRect = { width: 100, height: 20 } as DOMRect;
            const mockRange = {
                getBoundingClientRect: () => mockRect,
            } as Range;
            const mockSelection = {
                rangeCount: 1,
                getRangeAt: () => mockRange,
            } as unknown as Selection;
            vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

            const result = getSelectionRect();
            expect(result).toEqual(mockRect);
        });
    });

    describe('isSelectionEditable', () => {
        it('should return false when no selection', () => {
            vi.spyOn(window, 'getSelection').mockReturnValue(null);

            const result = isSelectionEditable();
            expect(result).toBe(false);
        });

        it('should return true when selection is in input', () => {
            const input = document.createElement('input');
            document.body.appendChild(input);

            const textNode = document.createTextNode('test');
            // Create a mock that simulates being inside an input
            const mockSelection = {
                rangeCount: 1,
                anchorNode: textNode,
            } as unknown as Selection;

            // Mock closest to return the input
            const mockElement = {
                closest: (selector: string) => selector.includes('input') ? input : null,
            } as unknown as Element;

            Object.defineProperty(textNode, 'parentElement', { value: mockElement });
            vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

            const result = isSelectionEditable();
            expect(result).toBe(true);

            document.body.removeChild(input);
        });

        it('should return false when selection is in regular text', () => {
            const div = document.createElement('div');
            const textNode = document.createTextNode('test');
            div.appendChild(textNode);
            document.body.appendChild(div);

            const mockSelection = {
                rangeCount: 1,
                anchorNode: textNode,
            } as unknown as Selection;
            vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

            const result = isSelectionEditable();
            expect(result).toBe(false);

            document.body.removeChild(div);
        });
    });

    describe('isSelectionInCode', () => {
        it('should return false when no selection', () => {
            vi.spyOn(window, 'getSelection').mockReturnValue(null);

            const result = isSelectionInCode();
            expect(result).toBe(false);
        });

        it('should return true when selection is in code element', () => {
            const code = document.createElement('code');
            const textNode = document.createTextNode('const x = 1;');
            code.appendChild(textNode);
            document.body.appendChild(code);

            const mockSelection = {
                rangeCount: 1,
                anchorNode: textNode,
            } as unknown as Selection;
            vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

            const result = isSelectionInCode();
            expect(result).toBe(true);

            document.body.removeChild(code);
        });

        it('should return true when selection is in pre element', () => {
            const pre = document.createElement('pre');
            const textNode = document.createTextNode('code block');
            pre.appendChild(textNode);
            document.body.appendChild(pre);

            const mockSelection = {
                rangeCount: 1,
                anchorNode: textNode,
            } as unknown as Selection;
            vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

            const result = isSelectionInCode();
            expect(result).toBe(true);

            document.body.removeChild(pre);
        });

        it('should return false when selection is in regular text', () => {
            const p = document.createElement('p');
            const textNode = document.createTextNode('regular text');
            p.appendChild(textNode);
            document.body.appendChild(p);

            const mockSelection = {
                rangeCount: 1,
                anchorNode: textNode,
            } as unknown as Selection;
            vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

            const result = isSelectionInCode();
            expect(result).toBe(false);

            document.body.removeChild(p);
        });
    });
});
