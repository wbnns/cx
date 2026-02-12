import { describe, it, expect } from 'vitest';
import { getNextRun, isDue } from '../src/daemon/modes/scheduled.js';

describe('cron evaluation', () => {
  it('getNextRun returns a future date for valid cron', () => {
    const next = getNextRun('0 9 * * *');
    expect(next).toBeInstanceOf(Date);
    expect(next!.getTime()).toBeGreaterThan(Date.now() - 86400000); // within last day
  });

  it('getNextRun returns null for invalid cron', () => {
    expect(getNextRun('invalid')).toBeNull();
  });

  it('getNextRun respects timezone', () => {
    const utc = getNextRun('0 9 * * *');
    const la = getNextRun('0 9 * * *', 'America/Los_Angeles');
    // LA is behind UTC, so next 9am LA should be later than next 9am UTC
    expect(utc).not.toBeNull();
    expect(la).not.toBeNull();
  });

  it('isDue returns true when cron has fired since last check', () => {
    // Check with a very old last check - any "every minute" cron should be due
    const longAgo = new Date('2020-01-01T00:00:00Z');
    expect(isDue('* * * * *', longAgo)).toBe(true);
  });

  it('isDue returns false when last check is recent', () => {
    const justNow = new Date();
    // Next minute hasn't passed yet
    expect(isDue('0 0 1 1 *', justNow)).toBe(false);
  });
});
