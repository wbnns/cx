import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import YAML from 'yaml';

describe('config YAML', () => {
  it('round-trips config through YAML', () => {
    const config = {
      vault_path: '/tmp/test-vault',
      claude_path: 'claude',
      default_model: 'sonnet',
      default_permission_mode: 'dangerouslySkipPermissions',
      cx_folder: 'cx',
      timezone: 'America/Los_Angeles',
      daemon: {
        tick_interval_seconds: 30,
        log_file: '~/.config/cx/daemon.log',
      },
      cost_limits: {
        warn_threshold_usd: 10,
        monthly_budget_usd: 100,
        daily_usd: 25,
        alert_thresholds: [5, 10, 25],
      },
      compaction: {
        default_model: 'haiku',
      },
    };

    const yamlStr = YAML.stringify(config, { indent: 2 });
    const parsed = YAML.parse(yamlStr);

    expect(parsed.vault_path).toBe('/tmp/test-vault');
    expect(parsed.daemon.tick_interval_seconds).toBe(30);
    expect(parsed.cost_limits.alert_thresholds).toEqual([5, 10, 25]);
    expect(parsed.compaction.default_model).toBe('haiku');
  });

  it('writes and reads YAML config file', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cx-config-'));
    const configPath = join(tmpDir, 'config.yaml');

    const config = {
      vault_path: tmpDir,
      claude_path: 'claude',
      default_model: 'sonnet',
      default_permission_mode: 'dangerouslySkipPermissions',
      timezone: 'UTC',
    };

    await writeFile(configPath, YAML.stringify(config, { indent: 2 }));
    const raw = await readFile(configPath, 'utf-8');
    const parsed = YAML.parse(raw);

    expect(parsed.vault_path).toBe(tmpDir);
    expect(parsed.default_model).toBe('sonnet');
    expect(parsed.timezone).toBe('UTC');
  });

  it('migrates JSON config to YAML format', () => {
    const jsonConfig = {
      vault_path: '/tmp/vault',
      claude_path: 'claude',
      default_model: 'sonnet',
      default_permission_mode: 'dangerouslySkipPermissions',
      cost_tracking: {
        warn_threshold_usd: 10,
        monthly_budget_usd: 100,
      },
    };

    // Simulate migration: rename cost_tracking → cost_limits
    const migrated = { ...jsonConfig } as Record<string, unknown>;
    if (migrated.cost_tracking) {
      migrated.cost_limits = migrated.cost_tracking;
      delete migrated.cost_tracking;
    }

    const yamlStr = YAML.stringify(migrated, { indent: 2 });
    const parsed = YAML.parse(yamlStr);

    expect(parsed.cost_limits).toBeDefined();
    expect(parsed.cost_tracking).toBeUndefined();
    expect(parsed.cost_limits.warn_threshold_usd).toBe(10);
  });
});
