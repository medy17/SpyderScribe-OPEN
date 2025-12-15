/**
 * Global test setup for Spider Scribe
 */
import { vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

// --- Chrome API Mocks ---
const mockStorage: Record<string, unknown> = {};

const chromeMock = {
    storage: {
        sync: {
            get: vi.fn(
                (
                    keys: string | string[] | null,
                    callback?: (result: Record<string, unknown>) => void,
                ) => {
                    const keysArray =
                        keys === null
                            ? Object.keys(mockStorage)
                            : Array.isArray(keys)
                                ? keys
                                : [keys];

                    const result: Record<string, unknown> = {};
                    keysArray.forEach((key) => {
                        if (key in mockStorage) result[key] = mockStorage[key];
                    });

                    if (callback) callback(result);
                    return Promise.resolve(result);
                },
            ),
            set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
                Object.assign(mockStorage, items);
                if (callback) callback();
                return Promise.resolve();
            }),
            clear: vi.fn((callback?: () => void) => {
                Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
                if (callback) callback();
                return Promise.resolve();
            }),
        },
    },
    runtime: {
        lastError: null as chrome.runtime.LastError | null,
        sendMessage: vi.fn(),
        onMessage: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
        },
    },
    tabs: {
        query: vi.fn(),
        sendMessage: vi.fn(),
        get: vi.fn(),
        onActivated: { addListener: vi.fn() },
        onUpdated: { addListener: vi.fn() },
    },
    contextMenus: {
        create: vi.fn(),
        update: vi.fn(),
        onClicked: {
            addListener: vi.fn(),
        },
    },
};

// @ts-expect-error - Mock chrome global
globalThis.chrome = chromeMock;

// --- Fetch Mock Helper ---
export function mockFetch(response: unknown, ok = true, status = 200) {
    return vi.fn().mockResolvedValue({
        ok,
        status,
        json: () => Promise.resolve(response),
        text: () => Promise.resolve(JSON.stringify(response)),
    });
}

export function mockFetchError(error: Error) {
    return vi.fn().mockRejectedValue(error);
}

// --- Reset between tests ---
beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    chromeMock.runtime.lastError = null;
});

afterEach(() => {
    vi.restoreAllMocks();
});

// --- Export for test files ---
export { chromeMock, mockStorage };