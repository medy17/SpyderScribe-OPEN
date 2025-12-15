/**
 * Tests for src/background/managers/contextMenu.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chromeMock, mockStorage } from '../../setup';

describe('setupContextMenu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

        // Mock tabs.get
        chromeMock.tabs.get = vi.fn().mockResolvedValue({ url: 'https://example.com' });
        // Mock tabs.onActivated
        chromeMock.tabs.onActivated = { addListener: vi.fn() };
        // Mock tabs.onUpdated
        chromeMock.tabs.onUpdated = { addListener: vi.fn() };
        // Mock contextMenus.update
        chromeMock.contextMenus.update = vi.fn();
    });

    it('should create translate selection menu item', async () => {
        const { setupContextMenu } = await import('@/background/managers/contextMenu');

        setupContextMenu();

        expect(chromeMock.contextMenus.create).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'translateSelection',
                title: 'Translate Selection',
                contexts: ['selection'],
            }),
            expect.any(Function)
        );
    });

    it('should create blacklist toggle menu item', async () => {
        const { setupContextMenu } = await import('@/background/managers/contextMenu');

        setupContextMenu();

        expect(chromeMock.contextMenus.create).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'toggleBlacklist',
                title: 'Disable Spider Scribe on this site',
                contexts: ['page'],
            }),
            expect.any(Function)
        );
    });

    it('should set up click listener', async () => {
        const { setupContextMenu } = await import('@/background/managers/contextMenu');

        setupContextMenu();

        expect(chromeMock.contextMenus.onClicked.addListener).toHaveBeenCalled();
    });

    it('should send translateSelection message on menu click', async () => {
        type ClickHandler = (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void;
        let clickHandler: ClickHandler = () => { };
        chromeMock.contextMenus.onClicked.addListener.mockImplementation((handler: ClickHandler) => {
            clickHandler = handler;
        });

        const { setupContextMenu } = await import('@/background/managers/contextMenu');
        setupContextMenu();

        // Simulate click with url included
        const info = { menuItemId: 'translateSelection' };
        const tab = { id: 123, url: 'https://example.com' };
        await clickHandler(info, tab);

        expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(123, { action: 'translateSelection' });
    });

    it('should not send message if tab has no id or url', async () => {
        type ClickHandler = (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void;
        let clickHandler: ClickHandler = () => { };
        chromeMock.contextMenus.onClicked.addListener.mockImplementation((handler: ClickHandler) => {
            clickHandler = handler;
        });

        const { setupContextMenu } = await import('@/background/managers/contextMenu');
        setupContextMenu();

        await clickHandler({ menuItemId: 'translateSelection' }, {}); // No tab id or url

        expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it('should toggle blacklist when toggleBlacklist clicked', async () => {
        type ClickHandler = (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void;
        let clickHandler: ClickHandler = () => { };
        chromeMock.contextMenus.onClicked.addListener.mockImplementation((handler: ClickHandler) => {
            clickHandler = handler;
        });

        const { setupContextMenu } = await import('@/background/managers/contextMenu');
        setupContextMenu();

        // Simulate click on blacklist toggle
        const info = { menuItemId: 'toggleBlacklist' };
        const tab = { id: 123, url: 'https://example.com' };
        await clickHandler(info, tab);

        // Should have updated storage with blacklist
        expect(chromeMock.storage.sync.set).toHaveBeenCalledWith({
            blacklistedSites: ['example.com'],
        });
    });

    it('should register tab activated listener', async () => {
        const { setupContextMenu } = await import('@/background/managers/contextMenu');

        setupContextMenu();

        expect(chromeMock.tabs.onActivated.addListener).toHaveBeenCalled();
    });

    it('should register tab updated listener', async () => {
        const { setupContextMenu } = await import('@/background/managers/contextMenu');

        setupContextMenu();

        expect(chromeMock.tabs.onUpdated.addListener).toHaveBeenCalled();
    });
});
