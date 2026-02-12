import { describe, it, expect } from 'vitest';
import { evaluateTriggerCondition } from '../src/daemon/modes/watcher.js';

describe('trigger condition evaluation', () => {
  it('returns true for empty condition', () => {
    expect(evaluateTriggerCondition('', {})).toBe(true);
  });

  it('evaluates simple comparison', () => {
    expect(evaluateTriggerCondition('x > 5', { x: 10 })).toBe(true);
    expect(evaluateTriggerCondition('x > 5', { x: 3 })).toBe(false);
  });

  it('evaluates equality', () => {
    expect(evaluateTriggerCondition('status == 1', { status: 1 })).toBe(true);
    expect(evaluateTriggerCondition('status == 1', { status: 0 })).toBe(false);
  });

  it('returns false for invalid expression', () => {
    expect(evaluateTriggerCondition('invalid %%% expression', { x: 1 })).toBe(false);
  });

  it('handles boolean-like values', () => {
    expect(evaluateTriggerCondition('changed', { changed: 1 })).toBe(true);
    expect(evaluateTriggerCondition('changed', { changed: 0 })).toBe(false);
  });
});
