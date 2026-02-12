import { describe, it, expect } from 'vitest';
import { agentFrontmatterSchema } from '../src/core/agent-schema.js';

describe('nested schema validation', () => {
  it('accepts valid scheduled agent', () => {
    const data = {
      name: 'test-scheduled',
      execution: {
        mode: 'scheduled',
        schedule: {
          expression: '0 9 * * *',
          type: 'cron',
          timezone: 'America/Los_Angeles',
        },
      },
      status: 'active',
    };
    const result = agentFrontmatterSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts valid watcher agent', () => {
    const data = {
      name: 'test-watcher',
      execution: {
        mode: 'watcher',
        watcher: {
          script: 'check.js',
          poll_interval_seconds: 60,
          cooldown_seconds: 300,
        },
      },
      status: 'active',
    };
    const result = agentFrontmatterSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts valid persistent agent', () => {
    const data = {
      name: 'test-persistent',
      execution: {
        mode: 'persistent',
        persistent: {
          heartbeat_interval_seconds: 1800,
          checkpoint_interval_minutes: 60,
          restart_policy: 'on_failure',
        },
      },
      status: 'active',
    };
    const result = agentFrontmatterSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects scheduled agent without schedule', () => {
    const data = {
      name: 'bad-scheduled',
      execution: { mode: 'scheduled' },
      status: 'active',
    };
    const result = agentFrontmatterSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects watcher agent without watcher config', () => {
    const data = {
      name: 'bad-watcher',
      execution: { mode: 'watcher' },
      status: 'active',
    };
    const result = agentFrontmatterSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('accepts full agent with all nested fields', () => {
    const data = {
      name: 'full-agent',
      type: 'agent',
      execution: {
        mode: 'scheduled',
        schedule: {
          expression: '*/5 * * * *',
          type: 'cron',
        },
      },
      status: 'active',
      categories: ['personal', 'monitoring'],
      tools: ['Read', 'Write'],
      resource_limits: {
        max_cost_usd: 1.0,
        max_tokens: 50000,
        max_duration_seconds: 600,
        max_tokens_per_hour: 100000,
        max_cost_per_day_usd: 10,
      },
      memory: {
        enabled: true,
        compaction_policy: 'summarize',
        max_current_tokens: 8000,
        archive_access: true,
      },
      notifications: [
        {
          channel: 'telegram',
          events: ['completion', 'failure'],
        },
      ],
    };
    const result = agentFrontmatterSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('status defaults to active', () => {
    const data = {
      name: 'defaulted',
      execution: {
        mode: 'scheduled',
        schedule: { expression: '0 9 * * *' },
      },
    };
    const result = agentFrontmatterSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('active');
    }
  });

  it('accepts failed status', () => {
    const data = {
      name: 'failed-agent',
      execution: {
        mode: 'scheduled',
        schedule: { expression: '0 9 * * *' },
      },
      status: 'failed',
    };
    const result = agentFrontmatterSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const data = {
      name: 'bad-status',
      execution: {
        mode: 'scheduled',
        schedule: { expression: '0 9 * * *' },
      },
      status: 'error',
    };
    const result = agentFrontmatterSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
