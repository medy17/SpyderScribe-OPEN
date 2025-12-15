/**
 * Tests for src/content/selection/blacklist.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chromeMock, mockStorage } from '../../setup';

// Import after mocks are set up
import { isBlacklisted, addToBlacklist, removeFromBlacklist, getAllBlacklisted } from '@/content/selection/blacklist';

describe('blacklist', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear storage
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    });

    describe('isBlacklisted', () => {
        it('should return false when blacklist is empty', async () => {
            const result = await isBlacklisted('example.com');
            expect(result).toBe(false);
        });

        it('should return true when hostname is in blacklist', async () => {
            mockStorage['blacklistedSites'] = ['example.com', 'test.com'];

            const result = await isBlacklisted('example.com');
            expect(result).toBe(true);
        });

        it('should return false when hostname is not in blacklist', async () => {
            mockStorage['blacklistedSites'] = ['other.com'];

            const result = await isBlacklisted('example.com');
            expect(result).toBe(false);
        });
    });

    describe('addToBlacklist', () => {
        it('should add hostname to empty blacklist', async () => {
            await addToBlacklist('example.com');

            expect(chromeMock.storage.sync.set).toHaveBeenCalledWith({
                blacklistedSites: ['example.com'],
            });
        });

        it('should add hostname to existing blacklist', async () => {
            mockStorage['blacklistedSites'] = ['other.com'];

            await addToBlacklist('example.com');

            expect(chromeMock.storage.sync.set).toHaveBeenCalledWith({
                blacklistedSites: ['other.com', 'example.com'],
            });
        });

        it('should not add duplicate hostname', async () => {
            mockStorage['blacklistedSites'] = ['example.com'];

            await addToBlacklist('example.com');

            // Should not call set since hostname already exists
            expect(chromeMock.storage.sync.set).not.toHaveBeenCalled();
        });
    });

    describe('removeFromBlacklist', () => {
        it('should remove hostname from blacklist', async () => {
            mockStorage['blacklistedSites'] = ['example.com', 'other.com'];

            await removeFromBlacklist('example.com');

            expect(chromeMock.storage.sync.set).toHaveBeenCalledWith({
                blacklistedSites: ['other.com'],
            });
        });

        it('should do nothing if hostname not in blacklist', async () => {
            mockStorage['blacklistedSites'] = ['other.com'];

            await removeFromBlacklist('example.com');

            expect(chromeMock.storage.sync.set).not.toHaveBeenCalled();
        });
    });

    describe('getAllBlacklisted', () => {
        it('should return empty array when no blacklist', async () => {
            const result = await getAllBlacklisted();
            expect(result).toEqual([]);
        });

        it('should return all blacklisted sites', async () => {
            mockStorage['blacklistedSites'] = ['a.com', 'b.com', 'c.com'];

            const result = await getAllBlacklisted();
            expect(result).toEqual(['a.com', 'b.com', 'c.com']);
        });
    });
});
