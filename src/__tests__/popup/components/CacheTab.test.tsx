/**
 * Tests for src/popup/components/CacheTab.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CacheTab from '@/popup/components/CacheTab';
import { chromeMock } from '../../setup';

// Mock sonner
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('CacheTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock responses
        chromeMock.runtime.sendMessage.mockImplementation((msg: { action: string }, callback: (response: unknown) => void) => {
            if (msg.action === 'getCacheStats') {
                callback({ memoryCount: 5, dbCount: 10, totalCount: 15 });
            } else if (msg.action === 'getCacheEntries') {
                callback({
                    entries: [
                        { key: '1', source: 'en', target: 'es', originalText: 'hello', translation: 'hola', createdAt: Date.now() }
                    ],
                    hasMore: false,
                    total: 1
                });
            } else if (msg.action === 'clearCache') {
                callback(true);
            }
        });
    });

    it('should render stats header', async () => {
        render(<CacheTab />);

        await waitFor(() => {
            expect(screen.getByText('Memory:')).toBeInTheDocument();
            expect(screen.getByText('Disk:')).toBeInTheDocument();
        });
    });

    it('should display memory count from stats', async () => {
        render(<CacheTab />);

        await waitFor(() => {
            expect(screen.getByText('5')).toBeInTheDocument(); // memoryCount
        });
    });

    it('should display cache entries', async () => {
        render(<CacheTab />);

        await waitFor(() => {
            expect(screen.getByText(/en → es/i)).toBeInTheDocument();
            expect(screen.getByText(/hello/i)).toBeInTheDocument();
        });
    });

    it('should render clear cache button', () => {
        render(<CacheTab />);

        expect(screen.getByRole('button', { name: /clear all cache/i })).toBeInTheDocument();
    });

    it('should call clearCache on button click', async () => {
        render(<CacheTab />);

        const clearBtn = screen.getByRole('button', { name: /clear all cache/i });
        fireEvent.click(clearBtn);

        await waitFor(() => {
            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
                { action: 'clearCache' },
                expect.any(Function)
            );
        });
    });

    it('should show empty state when no entries', async () => {
        chromeMock.runtime.sendMessage.mockImplementation((msg: { action: string }, callback: (response: unknown) => void) => {
            if (msg.action === 'getCacheStats') {
                callback({ memoryCount: 0, dbCount: 0, totalCount: 0 });
            } else if (msg.action === 'getCacheEntries') {
                callback({ entries: [], hasMore: false, total: 0 });
            }
        });

        render(<CacheTab />);

        await waitFor(() => {
            expect(screen.getByText(/no cached translations/i)).toBeInTheDocument();
        });
    });

    it('should show load more button when hasMore is true', async () => {
        chromeMock.runtime.sendMessage.mockImplementation((msg: { action: string }, callback: (response: unknown) => void) => {
            if (msg.action === 'getCacheStats') {
                callback({ memoryCount: 25, dbCount: 10, totalCount: 35 });
            } else if (msg.action === 'getCacheEntries') {
                callback({
                    entries: Array(15).fill({
                        key: '1', source: 'en', target: 'es', originalText: 'hello', translation: 'hola', createdAt: Date.now()
                    }),
                    hasMore: true,
                    total: 35
                });
            }
        });

        render(<CacheTab />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
        });
    });
});
