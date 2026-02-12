import { describe, it, expect } from 'vitest';
import { WordCountHeuristic } from '../src/memory/token-counter.js';

describe('WordCountHeuristic', () => {
  const counter = new WordCountHeuristic();

  it('counts empty string as 0', () => {
    expect(counter.count('')).toBe(0);
  });

  it('counts single word', () => {
    expect(counter.count('hello')).toBe(2); // 1 * 1.4 = 1.4, ceil = 2
  });

  it('counts multiple words', () => {
    expect(counter.count('hello world foo bar')).toBe(6); // 4 * 1.4 = 5.6, ceil = 6
  });

  it('handles whitespace variations', () => {
    expect(counter.count('  hello   world  ')).toBe(3); // 2 * 1.4 = 2.8, ceil = 3
  });

  it('uses custom multiplier', () => {
    const custom = new WordCountHeuristic(2.0);
    expect(custom.count('hello world')).toBe(4); // 2 * 2.0 = 4
  });
});
