/**
 * Tests for src/lib/utils.ts
 */
import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
    it('should merge class names', () => {
        expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
        const isActive = true;
        const isHidden = false;
        expect(cn('base', isActive && 'active', isHidden && 'hidden')).toBe('base active');
    });

    it('should merge tailwind classes intelligently', () => {
        expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    });

    it('should handle arrays', () => {
        expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
    });

    it('should handle objects', () => {
        expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
    });

    it('should return empty string for no args', () => {
        expect(cn()).toBe('');
    });
});
