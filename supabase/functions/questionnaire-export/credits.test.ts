import { describe, expect, it } from 'bun:test';
import { hasEnoughExportCredits } from './credits.ts';

describe('questionnaire export credit access', () => {
  it('allows export when available credits meet the five-credit export cost', () => {
    expect(hasEnoughExportCredits(5, 5)).toBe(true);
  });

  it('blocks export when available credits are below the five-credit export cost', () => {
    expect(hasEnoughExportCredits(4, 5)).toBe(false);
  });
});