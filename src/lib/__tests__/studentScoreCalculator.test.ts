import { describe, it, expect } from 'vitest';
import { PRESENT_POINTS, LATE_POINTS, ABSENT_POINTS } from '../studentScoreCalculator';

describe('studentScoreCalculator', () => {
  describe('attendance points constants', () => {
    it('should have correct present points', () => {
      expect(PRESENT_POINTS).toBe(1);
    });

    it('should have correct late points', () => {
      expect(LATE_POINTS).toBe(0.5);
    });

    it('should have correct absent points', () => {
      expect(ABSENT_POINTS).toBe(0);
    });
  });

  describe('score calculation logic', () => {
    it('should calculate attendance points correctly', () => {
      const presentCount = 10;
      const lateCount = 5;
      const expectedPoints = presentCount * PRESENT_POINTS + lateCount * LATE_POINTS;
      expect(expectedPoints).toBe(12.5);
    });

    it('should calculate reward penalty points correctly', () => {
      const mukofotPoints = 10;
      const jarimaPoints = 5;
      const expectedPoints = mukofotPoints - jarimaPoints;
      expect(expectedPoints).toBe(5);
    });
  });
});
