/// <reference types="chrome" />

const BLACKLIST_MENU_ID = 'toggleBlacklist';
const TRANSLATE_MENU_ID = 'translateSelection';
const STORAGE_KEY = 'blacklistedSites';

export function setupContextMenu(): void {
    // Translate selection menu item
    chrome.contextMenus.create(
        {
            id: TRANSLATE_MENU_ID,
            title: 'Translate Selection',
            contexts: ['selection'],
        },
        () => chrome.runtime.lastError && {}
    );

    // Blacklist toggle menu item (on page right-click)
    chrome.contextMenus.create(
        {
            id: BLACKLIST_MENU_ID,
            title: 'Disable Spyder-Scribe on this site',
            contexts: ['page'],
        },
        () => chrome.runtime.lastError && {}
    );

    // Handle menu clicks
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        if (!tab?.id || !tab.url) return;

        const url = new URL(tab.url);
        const hostname = url.hostname;

        if (info.menuItemId === TRANSLATE_MENU_ID) {
            chrome.tabs.sendMessage(tab.id, { action: 'translateSelection' });
        }

        if (info.menuItemId === BLACKLIST_MENU_ID) {
            await toggleBlacklist(hostname);
        }
    });

    // Update menu title when tab changes
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
            await updateBlacklistMenuTitle(tab.url);
        }
    });

    // Update menu title when URL changes
    chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
        if (changeInfo.url && tab.active) {
            await updateBlacklistMenuTitle(changeInfo.url);
        }
    });
}

async function getBlacklist(): Promise<string[]> {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    return (result[STORAGE_KEY] as string[]) || [];
}

async function toggleBlacklist(hostname: string): Promise<void> {
    const blacklist = await getBlacklist();
    const index = blacklist.indexOf(hostname);

    if (index > -1) {
        // Remove from blacklist
        blacklist.splice(index, 1);
    } else {
        // Add to blacklist
        blacklist.push(hostname);
    }

    await chrome.storage.sync.set({ [STORAGE_KEY]: blacklist });

    // Update menu title
    const isBlacklisted = index === -1; // After toggle
    chrome.contextMenus.update(BLACKLIST_MENU_ID, {
        title: isBlacklisted
            ? `Enable Spyder-Scribe on ${hostname}`
            : 'Disable Spyder-Scribe on this site',
    });
}

async function updateBlacklistMenuTitle(urlString: string): Promise<void> {
    try {
        const url = new URL(urlString);
        const hostname = url.hostname;
        const blacklist = await getBlacklist();
        const isBlacklisted = blacklist.includes(hostname);

        chrome.contextMenus.update(BLACKLIST_MENU_ID, {
            title: isBlacklisted
                ? `Enable Spyder-Scribe on ${hostname}`
                : 'Disable Spyder-Scribe on this site',
        });
    } catch {
        // Invalid URL, ignore
    }
}

