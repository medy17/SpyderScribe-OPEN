/// <reference types="chrome" />

const STORAGE_KEY = 'blacklistedSites';

/**
 * Get the current blacklist from storage
 */
async function getBlacklist(): Promise<string[]> {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    return (result[STORAGE_KEY] as string[]) || [];
}

/**
 * Check if a hostname is blacklisted
 */
export async function isBlacklisted(hostname: string): Promise<boolean> {
    const blacklist = await getBlacklist();
    return blacklist.includes(hostname);
}

/**
 * Add a hostname to the blacklist
 */
export async function addToBlacklist(hostname: string): Promise<void> {
    const blacklist = await getBlacklist();
    if (!blacklist.includes(hostname)) {
        blacklist.push(hostname);
        await chrome.storage.sync.set({ [STORAGE_KEY]: blacklist });
    }
}

/**
 * Remove a hostname from the blacklist
 */
export async function removeFromBlacklist(hostname: string): Promise<void> {
    const blacklist = await getBlacklist();
    const index = blacklist.indexOf(hostname);
    if (index > -1) {
        blacklist.splice(index, 1);
        await chrome.storage.sync.set({ [STORAGE_KEY]: blacklist });
    }
}

/**
 * Get all blacklisted sites
 */
export async function getAllBlacklisted(): Promise<string[]> {
    return getBlacklist();
}
