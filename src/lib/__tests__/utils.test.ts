import { describe, it, expect } from 'vitest';
import { cn, getTashkentDate, getTashkentToday, formatDateUz } from '../utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    });
  });

  describe('getTashkentDate', () => {
    it('should return a Date object', () => {
      const result = getTashkentDate();
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('getTashkentToday', () => {
    it('should return a string in YYYY-MM-DD format', () => {
      const result = getTashkentToday();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('formatDateUz', () => {
    it('should format Date object in long format', () => {
      const date = new Date('2024-01-15');
      const result = formatDateUz(date, 'long');
      expect(result).toContain('yanvar');
      expect(result).toContain('2024');
    });

    it('should format Date object in short format', () => {
      const date = new Date('2024-01-15');
      const result = formatDateUz(date, 'short');
      expect(result).toBe('15.01.2024');
    });

    it('should handle Firestore Timestamp', () => {
      const timestamp = { seconds: 1705276800 }; // 2024-01-15
      const result = formatDateUz(timestamp, 'short');
      expect(result).toBe('15.01.2024');
    });

    it('should return placeholder for null date', () => {
      const result = formatDateUz(null, 'short');
      expect(result).toBe('--.--.----');
    });

    it('should return placeholder for undefined date', () => {
      const result = formatDateUz(undefined, 'long');
      expect(result).toBe("Sana yo'q");
    });
  });
});
