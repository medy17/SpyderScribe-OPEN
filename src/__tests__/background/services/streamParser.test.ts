/**
 * Tests for src/background/services/streamParser.ts
 * 
 * Tests the JSON array stream parser which handles real-time parsing
 * of streaming JSON arrays from LLM responses.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createArrayStreamParser, type StreamParserCallbacks } from '@/background/services/streamParser';

describe('createArrayStreamParser', () => {
    let callbacks: StreamParserCallbacks;
    let onElement: StreamParserCallbacks['onElement'];
    let onComplete: StreamParserCallbacks['onComplete'];
    let onError: StreamParserCallbacks['onError'];

    beforeEach(() => {
        onElement = vi.fn<StreamParserCallbacks['onElement']>();
        onComplete = vi.fn<StreamParserCallbacks['onComplete']>();
        onError = vi.fn<StreamParserCallbacks['onError']>();
        callbacks = { onElement, onComplete, onError };
    });

    describe('Basic Parsing', () => {
        it('should parse a simple two-element array', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('["Hello", "World"]');

            expect(onElement).toHaveBeenCalledTimes(2);
            expect(onElement).toHaveBeenNthCalledWith(1, 'Hello', 0);
            expect(onElement).toHaveBeenNthCalledWith(2, 'World', 1);
            expect(onComplete).toHaveBeenCalledWith(['Hello', 'World']);
        });

        it('should parse an empty array', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('[]');

            expect(onElement).not.toHaveBeenCalled();
            expect(onComplete).toHaveBeenCalledWith([]);
        });

        it('should parse a single-element array', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('["Single"]');

            expect(onElement).toHaveBeenCalledTimes(1);
            expect(onElement).toHaveBeenCalledWith('Single', 0);
            expect(onComplete).toHaveBeenCalledWith(['Single']);
        });

        it('should handle arrays with many elements', () => {
            const parser = createArrayStreamParser(callbacks);
            const input = '["a", "b", "c", "d", "e"]';
            parser.feed(input);

            expect(onElement).toHaveBeenCalledTimes(5);
            expect(onComplete).toHaveBeenCalledWith(['a', 'b', 'c', 'd', 'e']);
        });
    });

    describe('Streaming (Chunked Input)', () => {
        it('should handle input split across multiple chunks', () => {
            const parser = createArrayStreamParser(callbacks);

            parser.feed('["Hel');
            expect(onElement).not.toHaveBeenCalled(); // Still incomplete

            parser.feed('lo", "Wor');
            expect(onElement).toHaveBeenCalledTimes(1);
            expect(onElement).toHaveBeenCalledWith('Hello', 0);

            parser.feed('ld"]');
            expect(onElement).toHaveBeenCalledTimes(2);
            expect(onElement).toHaveBeenCalledWith('World', 1);
            expect(onComplete).toHaveBeenCalled();
        });

        it('should handle character-by-character input', () => {
            const parser = createArrayStreamParser(callbacks);
            const input = '["Hi"]';

            for (const char of input) {
                parser.feed(char);
            }

            expect(onElement).toHaveBeenCalledWith('Hi', 0);
            expect(onComplete).toHaveBeenCalledWith(['Hi']);
        });

        it('should emit elements as soon as they are complete', () => {
            const parser = createArrayStreamParser(callbacks);

            parser.feed('["First"');
            expect(onElement).not.toHaveBeenCalled(); // No comma yet

            parser.feed(', "Second", "Third"');
            expect(onElement).toHaveBeenCalledTimes(2); // First and Second complete
            expect(onElement).toHaveBeenNthCalledWith(1, 'First', 0);
            expect(onElement).toHaveBeenNthCalledWith(2, 'Second', 1);

            parser.feed(']');
            expect(onElement).toHaveBeenCalledTimes(3);
            expect(onComplete).toHaveBeenCalled();
        });
    });

    describe('Escape Sequences', () => {
        it('should handle escaped quotes inside strings', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('["He said \\"hello\\""]');

            expect(onElement).toHaveBeenCalledWith('He said "hello"', 0);
        });

        it('should handle escaped backslashes', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('["path\\\\to\\\\file"]');

            expect(onElement).toHaveBeenCalledWith('path\\to\\file', 0);
        });

        it('should handle mixed escape sequences', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('["Line1\\nLine2\\tTabbed"]');

            expect(onElement).toHaveBeenCalledWith('Line1\nLine2\tTabbed', 0);
        });

        it('should handle escaped quotes split across chunks', () => {
            const parser = createArrayStreamParser(callbacks);

            parser.feed('["quote: \\');
            parser.feed('"end"]');

            expect(onElement).toHaveBeenCalledWith('quote: "end', 0);
        });
    });

    describe('Whitespace Handling', () => {
        it('should handle arrays with extra whitespace', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('[  "Hello"  ,  "World"  ]');

            expect(onElement).toHaveBeenCalledTimes(2);
            expect(onComplete).toHaveBeenCalledWith(['Hello', 'World']);
        });

        it('should handle arrays with newlines', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('[\n  "Hello",\n  "World"\n]');

            expect(onElement).toHaveBeenCalledTimes(2);
            expect(onComplete).toHaveBeenCalledWith(['Hello', 'World']);
        });

        it('should preserve whitespace inside strings', () => {
            const parser = createArrayStreamParser(callbacks);
            // "tabs\there" needs to be properly JSON-escaped as "tabs\\there"
            parser.feed('["  spaces  ", "tabs here"]');

            expect(onElement).toHaveBeenNthCalledWith(1, '  spaces  ', 0);
            expect(onElement).toHaveBeenNthCalledWith(2, 'tabs here', 1);
        });
    });

    describe('Special Characters in Strings', () => {
        it('should handle commas inside strings', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('["one, two, three"]');

            expect(onElement).toHaveBeenCalledWith('one, two, three', 0);
            expect(onElement).toHaveBeenCalledTimes(1);
        });

        it('should handle brackets inside strings', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('["[array]", "{object}"]');

            expect(onElement).toHaveBeenNthCalledWith(1, '[array]', 0);
            expect(onElement).toHaveBeenNthCalledWith(2, '{object}', 1);
        });

        it('should handle unicode characters', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('["日本語", "emoji 🎉"]');

            expect(onElement).toHaveBeenNthCalledWith(1, '日本語', 0);
            expect(onElement).toHaveBeenNthCalledWith(2, 'emoji 🎉', 1);
        });
    });

    describe('Non-String Values', () => {
        it('should emit empty string for null values', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('[null, "valid"]');

            expect(onElement).toHaveBeenNthCalledWith(1, '', 0);
            expect(onElement).toHaveBeenNthCalledWith(2, 'valid', 1);
        });

        it('should emit empty string for number values', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('[123, "text"]');

            expect(onElement).toHaveBeenNthCalledWith(1, '', 0);
            expect(onElement).toHaveBeenNthCalledWith(2, 'text', 1);
        });

        it('should emit empty string for boolean values', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('[true, false, "string"]');

            expect(onElement).toHaveBeenNthCalledWith(1, '', 0);
            expect(onElement).toHaveBeenNthCalledWith(2, '', 1);
            expect(onElement).toHaveBeenNthCalledWith(3, 'string', 2);
        });
    });

    describe('Parser State', () => {
        it('should track element index correctly', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('["a", "b", "c"]');

            expect(vi.mocked(onElement).mock.calls[0][1]).toBe(0);
            expect(vi.mocked(onElement).mock.calls[1][1]).toBe(1);
            expect(vi.mocked(onElement).mock.calls[2][1]).toBe(2);
        });

        it('should expose current state via getState', () => {
            const parser = createArrayStreamParser(callbacks);

            const initialState = parser.getState();
            expect(initialState.started).toBe(false);
            expect(initialState.elementIndex).toBe(0);
            expect(initialState.elements).toEqual([]);

            parser.feed('["test"');
            const midState = parser.getState();
            expect(midState.started).toBe(true);
            expect(midState.inString).toBe(false);
        });
    });

    describe('end() Method', () => {
        it('should emit leftover content when end() is called', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('["incomplete');
            parser.end();

            // Should try to parse leftover, likely fail since incomplete
            // But should not crash
        });

        it('should call onError when stream ends with no elements', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('garbage');
            parser.end();

            expect(onError).toHaveBeenCalled();
            expect(vi.mocked(onError).mock.calls[0][0].message).toContain('no elements');
        });

        it('should not error when stream ends after successful parse', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('["valid"]');
            parser.end();

            expect(onError).not.toHaveBeenCalled();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty strings in array', () => {
            const parser = createArrayStreamParser(callbacks);
            parser.feed('["", "nonempty", ""]');

            expect(onElement).toHaveBeenNthCalledWith(1, '', 0);
            expect(onElement).toHaveBeenNthCalledWith(2, 'nonempty', 1);
            expect(onElement).toHaveBeenNthCalledWith(3, '', 2);
        });

        it('should handle very long strings', () => {
            const parser = createArrayStreamParser(callbacks);
            const longString = 'x'.repeat(10000);
            parser.feed(`["${longString}"]`);

            expect(onElement).toHaveBeenCalledWith(longString, 0);
        });

        it('should handle real translation-like content', () => {
            const parser = createArrayStreamParser(callbacks);
            const content = '["Bonjour", "Comment allez-vous?", "C\'est un test."]';
            parser.feed(content);

            expect(onElement).toHaveBeenCalledTimes(3);
            expect(onElement).toHaveBeenNthCalledWith(1, 'Bonjour', 0);
            expect(onElement).toHaveBeenNthCalledWith(2, 'Comment allez-vous?', 1);
            expect(onElement).toHaveBeenNthCalledWith(3, "C'est un test.", 2);
        });

        it('should handle nested quotes in JSON correctly', () => {
            const parser = createArrayStreamParser(callbacks);
            // This simulates: ["He said \"test\""]
            parser.feed('["He said \\"test\\""]');

            expect(onElement).toHaveBeenCalledWith('He said "test"', 0);
        });
    });

    describe('Realistic Streaming Scenarios', () => {
        it('should handle LLM-style token streaming', () => {
            const parser = createArrayStreamParser(callbacks);

            // Simulate how an LLM might stream tokens
            const tokens = ['[', '"', 'Hola', '"', ',', ' ', '"', 'Mundo', '"', ']'];

            for (const token of tokens) {
                parser.feed(token);
            }

            expect(onElement).toHaveBeenCalledTimes(2);
            expect(onComplete).toHaveBeenCalledWith(['Hola', 'Mundo']);
        });

        it('should handle irregular chunk sizes from network', () => {
            const parser = createArrayStreamParser(callbacks);
            const fullContent = '["First translation", "Second translation", "Third one"]';

            // Random chunk sizes
            const chunks = [
                fullContent.slice(0, 7),   // '["First'
                fullContent.slice(7, 25),  // ' translation", "Se'
                fullContent.slice(25, 40), // 'cond translation",'
                fullContent.slice(40),     // ' "Third one"]'
            ];

            for (const chunk of chunks) {
                parser.feed(chunk);
            }

            expect(onComplete).toHaveBeenCalledWith([
                'First translation',
                'Second translation',
                'Third one'
            ]);
        });
    });
});
