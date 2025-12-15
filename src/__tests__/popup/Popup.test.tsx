/**
 * Tests for src/popup/Popup.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Popup from '@/popup/Popup';

// Mock child components
vi.mock('@/popup/components/TranslateTab', () => ({
    default: () => <div data-testid="translate-tab">Translate Tab Content</div>,
}));

vi.mock('@/popup/components/SettingsTab', () => ({
    default: () => <div data-testid="settings-tab">Settings Tab Content</div>,
}));

vi.mock('@/popup/components/CacheTab', () => ({
    default: () => <div data-testid="cache-tab">Cache Tab Content</div>,
}));

vi.mock('sonner', () => ({
    Toaster: () => <div data-testid="toaster" />,
}));

describe('Popup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render header with Spider Scribe title', () => {
        render(<Popup />);

        expect(screen.getByText('Spider Scribe')).toBeInTheDocument();
    });

    it('should render all three tab triggers', () => {
        render(<Popup />);

        expect(screen.getByRole('tab', { name: 'Translate' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Cache' })).toBeInTheDocument();
    });

    it('should show Translate tab by default', () => {
        render(<Popup />);

        expect(screen.getByTestId('translate-tab')).toBeInTheDocument();
    });

    it('should have Translate tab selected by default', () => {
        render(<Popup />);

        const translateTab = screen.getByRole('tab', { name: 'Translate' });
        expect(translateTab.getAttribute('data-state')).toBe('active');
    });

    it('should render Toaster component', () => {
        render(<Popup />);

        expect(screen.getByTestId('toaster')).toBeInTheDocument();
    });

    it('should have correct container styling', () => {
        const { container } = render(<Popup />);

        const mainDiv = container.firstChild as HTMLElement;
        expect(mainDiv.className).toContain('w-[360px]');
        expect(mainDiv.className).toContain('min-h-[480px]');
    });
});
