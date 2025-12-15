/**
 * Tests for src/popup/components/TranslateTab.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TranslateTab from '@/popup/components/TranslateTab';
import { chromeMock } from '../../setup';

// Mock sonner
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('TranslateTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock chrome.tabs.query
        chromeMock.tabs.query.mockImplementation((_, callback) => {
            callback?.([{ id: 1 }]);
            return Promise.resolve([{ id: 1 }]);
        });
        // Mock chrome.tabs.sendMessage
        chromeMock.tabs.sendMessage.mockImplementation((_, __, callback) => {
            if (callback) callback(true);
            return Promise.resolve(true);
        });
    });

    it('should render language selection labels', () => {
        render(<TranslateTab />);

        expect(screen.getByText('Translate from')).toBeInTheDocument();
        expect(screen.getByText('Translate to')).toBeInTheDocument();
    });

    it('should render translate button', () => {
        render(<TranslateTab />);

        expect(screen.getByRole('button', { name: /translate page/i })).toBeInTheDocument();
    });

    it('should render revert button', () => {
        render(<TranslateTab />);

        expect(screen.getByRole('button', { name: /revert/i })).toBeInTheDocument();
    });

    it('should show loading state when translating', async () => {
        chromeMock.tabs.query.mockImplementation(() => Promise.resolve([{ id: 1 }]));
        chromeMock.tabs.sendMessage.mockImplementation(() => new Promise(() => { })); // Never resolve

        render(<TranslateTab />);

        const translateBtn = screen.getByRole('button', { name: /translate page/i });
        fireEvent.click(translateBtn);

        await waitFor(() => {
            expect(screen.getByText(/translating/i)).toBeInTheDocument();
        });
    });

    it('should render with default trigger values', () => {
        render(<TranslateTab />);

        // Check for default values shown in the select triggers
        const triggers = screen.getAllByRole('combobox');
        expect(triggers).toHaveLength(2);
    });
});
