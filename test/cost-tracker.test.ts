import { describe, it, expect } from 'vitest';
import { aggregateCosts } from '../src/storage/cost-tracker.js';
import type { CostRecord } from '../src/types/index.js';

describe('cost aggregation', () => {
  const records: CostRecord[] = [
    { date: '2024-01-15', agent: 'surf', mode: 'scheduled', categories: ['personal'], cost_usd: 0.05, input_tokens: 100, output_tokens: 200, duration_ms: 5000 },
    { date: '2024-01-16', agent: 'surf', mode: 'scheduled', categories: ['personal'], cost_usd: 0.03, input_tokens: 80, output_tokens: 150, duration_ms: 4000 },
    { date: '2024-01-15', agent: 'monitor', mode: 'watcher', categories: ['work'], cost_usd: 0.10, input_tokens: 500, output_tokens: 300, duration_ms: 10000 },
  ];

  it('aggregates by agent', () => {
    const groups = aggregateCosts(records, 'agent');
    expect(groups.get('surf')).toEqual({ total_cost: 0.08, total_runs: 2 });
    expect(groups.get('monitor')).toEqual({ total_cost: 0.10, total_runs: 1 });
  });

  it('aggregates by mode', () => {
    const groups = aggregateCosts(records, 'mode');
    expect(groups.get('scheduled')?.total_runs).toBe(2);
    expect(groups.get('watcher')?.total_runs).toBe(1);
  });

  it('aggregates by category', () => {
    const groups = aggregateCosts(records, 'category');
    expect(groups.get('personal')?.total_runs).toBe(2);
    expect(groups.get('work')?.total_runs).toBe(1);
  });

  it('handles records without categories', () => {
    const recordsWithoutCat: CostRecord[] = [
      { date: '2024-01-15', agent: 'surf', mode: 'scheduled', cost_usd: 0.05, input_tokens: 100, output_tokens: 200, duration_ms: 5000 },
    ];
    const groups = aggregateCosts(recordsWithoutCat, 'category');
    expect(groups.get('uncategorized')?.total_runs).toBe(1);
  });
});
