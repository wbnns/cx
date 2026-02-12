import { z } from 'zod';
import YAML from 'yaml';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { CxConfig } from '../types/index.js';

const CONFIG_DIR = join(homedir(), '.config', 'cx');
const CONFIG_FILE = join(CONFIG_DIR, 'config.yaml');
const LEGACY_CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export const configSchema = z.object({
  cx_path: z.string(),
  claude_path: z.string().default('claude'),
  default_model: z.string().default('sonnet'),
  default_permission_mode: z.string().default('dangerouslySkipPermissions'),
  cx_folder: z.string().optional(),
  timezone: z.string().optional(),
  daemon: z.object({
    tick_interval_seconds: z.number().int().positive().optional(),
    log_file: z.string().optional(),
    pid_file: z.string().optional(),
  }).optional(),
  notifications: z.object({
    telegram: z.object({
      bot_token: z.string(),
      default_chat_id: z.string(),
    }).optional(),
  }).optional(),
  cost_limits: z.object({
    warn_threshold_usd: z.number().optional(),
    monthly_budget_usd: z.number().optional(),
    daily_usd: z.number().optional(),
    alert_thresholds: z.array(z.number()).optional(),
  }).optional(),
  compaction: z.object({
    default_model: z.string().optional(),
  }).optional(),
});

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigFile(): string {
  return CONFIG_FILE;
}

export function getSocketPath(): string {
  return join(CONFIG_DIR, 'daemon.sock');
}

export function getPidFile(): string {
  return join(CONFIG_DIR, 'daemon.pid');
}

export function getStateFile(): string {
  return join(CONFIG_DIR, 'daemon-state.json');
}

export function getSecretsDir(): string {
  return join(CONFIG_DIR, 'secrets');
}

export function getDaemonLogFile(config?: CxConfig): string {
  return config?.daemon?.log_file ?? join(CONFIG_DIR, 'daemon.log');
}

export async function loadConfig(): Promise<CxConfig> {
  let raw: string;
  try {
    raw = await readFile(CONFIG_FILE, 'utf-8');
  } catch {
    // Auto-migrate from config.json if config.yaml doesn't exist
    try {
      const jsonRaw = await readFile(LEGACY_CONFIG_FILE, 'utf-8');
      const jsonConfig = JSON.parse(jsonRaw);
      // Migrate cost_tracking → cost_limits
      if (jsonConfig.cost_tracking && !jsonConfig.cost_limits) {
        jsonConfig.cost_limits = jsonConfig.cost_tracking;
        delete jsonConfig.cost_tracking;
      }
      const parsed = configSchema.parse(jsonConfig) as CxConfig;
      await saveConfig(parsed);
      return parsed;
    } catch {
      throw new Error(`Config not found. Run 'cx init' first.`);
    }
  }
  const data = YAML.parse(raw);
  return configSchema.parse(data) as CxConfig;
}

export async function saveConfig(config: CxConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, YAML.stringify(config, { indent: 2 }));
}

export async function configExists(): Promise<boolean> {
  try {
    await readFile(CONFIG_FILE, 'utf-8');
    return true;
  } catch {
    try {
      await readFile(LEGACY_CONFIG_FILE, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }
}
