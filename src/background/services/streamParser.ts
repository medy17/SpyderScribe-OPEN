/**
 * JSON Array Stream Parser
 * 
 * Parses a streaming JSON array and emits each complete element as it arrives.
 * Handles escaped quotes and nested strings correctly using a state machine.
 */

export interface StreamParserCallbacks {
    onElement: (element: string, index: number) => void;
    onComplete: (elements: string[]) => void;
    onError: (error: Error) => void;
}

const DEBUG = true; // Enable debug logging

interface ParserState {
    buffer: string;
    inString: boolean;
    escapeNext: boolean;
    bracketDepth: number;
    currentElement: string;
    elementIndex: number;
    elements: string[];
    started: boolean;
}

/**
 * Creates a streaming JSON array parser.
 * Feed chunks of text via `feed()` and receive callbacks as elements complete.
 */
export function createArrayStreamParser(callbacks: StreamParserCallbacks) {
    const state: ParserState = {
        buffer: '',
        inString: false,
        escapeNext: false,
        bracketDepth: 0,
        currentElement: '',
        elementIndex: 0,
        elements: [],
        started: false,
    };

    function processChar(char: string): void {
        // Handle escape sequences
        if (state.escapeNext) {
            state.escapeNext = false;
            state.currentElement += char;
            return;
        }

        if (char === '\\' && state.inString) {
            state.escapeNext = true;
            state.currentElement += char;
            return;
        }

        // Handle string boundaries
        if (char === '"') {
            state.inString = !state.inString;
            state.currentElement += char;
            return;
        }

        // If inside a string, just accumulate
        if (state.inString) {
            state.currentElement += char;
            return;
        }

        // Outside string - check for structural chars
        switch (char) {
            case '[':
                if (!state.started) {
                    state.started = true;
                } else {
                    // Nested array (shouldn't happen for our use case, but handle it)
                    state.bracketDepth++;
                    state.currentElement += char;
                }
                break;

            case ']':
                if (state.bracketDepth > 0) {
                    state.bracketDepth--;
                    state.currentElement += char;
                } else {
                    // End of main array
                    emitCurrentElement();
                    callbacks.onComplete(state.elements);
                }
                break;

            case ',':
                if (state.bracketDepth === 0) {
                    // Element boundary
                    emitCurrentElement();
                } else {
                    state.currentElement += char;
                }
                break;

            case ' ':
            case '\n':
            case '\r':
            case '\t':
                // Whitespace outside string - skip unless inside element
                if (state.currentElement.length > 0) {
                    state.currentElement += char;
                }
                break;

            default:
                state.currentElement += char;
        }
    }

    function emitCurrentElement(): void {
        const trimmed = state.currentElement.trim();
        if (trimmed.length === 0) return;

        if (DEBUG) console.log('[StreamParser] Attempting to parse element:', trimmed.substring(0, 100));

        try {
            // Parse the JSON string element
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === 'string') {
                state.elements.push(parsed);
                callbacks.onElement(parsed, state.elementIndex);
                if (DEBUG) console.log(`[StreamParser] Emitted element ${state.elementIndex}:`, parsed.substring(0, 50));
                state.elementIndex++;
            } else {
                // Handle non-string values (null, empty, etc.) - emit as empty string
                console.warn('[StreamParser] Non-string element, emitting empty:', typeof parsed, parsed);
                state.elements.push('');
                callbacks.onElement('', state.elementIndex);
                state.elementIndex++;
            }
        } catch (e) {
            console.error('[StreamParser] Failed to parse element:', trimmed, e);
        }

        state.currentElement = '';
    }

    return {
        /**
         * Feed a chunk of streamed text to the parser
         */
        feed(chunk: string): void {
            for (const char of chunk) {
                try {
                    processChar(char);
                } catch (e) {
                    callbacks.onError(e instanceof Error ? e : new Error(String(e)));
                }
            }
        },

        /**
         * Signal that the stream has ended (for cleanup/error detection)
         */
        end(): void {
            if (state.currentElement.trim().length > 0 && !state.inString) {
                // There's leftover content - try to emit it
                emitCurrentElement();
            }
            if (state.elements.length === 0) {
                callbacks.onError(new Error('Stream ended with no elements parsed'));
            }
        },

        /**
         * Get current parse state for debugging
         */
        getState(): Readonly<ParserState> {
            return { ...state };
        }
    };
}
