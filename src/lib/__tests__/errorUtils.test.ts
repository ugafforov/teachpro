import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeError, logError, safeLogError } from '../errorUtils';

describe('errorUtils', () => {
  beforeEach(() => {
    vi.resetModules();
    // Mock import.meta.env.DEV
    vi.stubGlobal('import', {
      meta: {
        env: {
          DEV: true,
        },
      },
    });
  });

  describe('sanitizeError', () => {
    it('should return user-friendly message for permission-denied error', () => {
      const error = { code: 'permission-denied' };
      const result = sanitizeError(error, 'fetch');
      expect(result.message).toBe("Kirishga ruxsat yo'q");
      expect(result.code).toBe('permission-denied');
    });

    it('should return user-friendly message for auth/invalid-email error', () => {
      const error = { code: 'auth/invalid-email' };
      const result = sanitizeError(error, 'auth');
      expect(result.message).toBe("Email formati noto'g'ri");
      expect(result.code).toBe('auth/invalid-email');
    });

    it('should return fallback message for unknown error', () => {
      const error = { code: 'unknown-error' };
      const result = sanitizeError(error, 'fetch');
      expect(result.message).toBe("Ma'lumotlarni yuklashda xatolik yuz berdi");
    });

    it('should return fallback message for null error', () => {
      const result = sanitizeError(null, 'fetch');
      expect(result.message).toBe("Ma'lumotlarni yuklashda xatolik yuz berdi");
    });

    it('should extract error code from Firebase error message', () => {
      const error = { message: 'Firebase: Error (auth/user-not-found).' };
      const result = sanitizeError(error, 'auth');
      expect(result.code).toBe('auth/user-not-found');
    });
  });

  describe('logError', () => {
    it('should log error in development mode', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logError('testContext', { message: 'test error' });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('safeLogError', () => {
    it('should log error in development mode', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      safeLogError('testContext', { message: 'test error' });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
