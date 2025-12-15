/**
 * Tests for src/popup/components/SettingsTab.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsTab from '@/popup/components/SettingsTab';
import { chromeMock, mockStorage } from '../../setup';

// Mock sonner
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('SettingsTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    });

    it('should render API key inputs', async () => {
        render(<SettingsTab />);

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/enter ai studio key/i)).toBeInTheDocument();
            expect(screen.getByPlaceholderText(/enter xai console key/i)).toBeInTheDocument();
            expect(screen.getByPlaceholderText(/enter openai api key/i)).toBeInTheDocument();
        });
    });

    it('should render model selector', async () => {
        render(<SettingsTab />);

        await waitFor(() => {
            expect(screen.getByText('AI Model')).toBeInTheDocument();
        });
    });

    it('should render save button', () => {
        render(<SettingsTab />);

        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('should render clear cache button', () => {
        render(<SettingsTab />);

        expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    it('should load settings from storage on mount', async () => {
        mockStorage['geminiApiKey'] = 'stored-key';

        render(<SettingsTab />);

        await waitFor(() => {
            const input = screen.getByPlaceholderText(/enter ai studio key/i) as HTMLInputElement;
            expect(input.value).toBe('stored-key');
        });
    });

    it('should save settings to storage', async () => {
        render(<SettingsTab />);

        await waitFor(() => {
            const input = screen.getByPlaceholderText(/enter ai studio key/i);
            fireEvent.change(input, { target: { value: 'new-key' } });
        });

        const saveBtn = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(chromeMock.storage.sync.set).toHaveBeenCalled();
        });
    });
});
