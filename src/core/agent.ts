import { readdir, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseAgentFile, writeAgentFile } from './agent-parser.js';
import { getAgentsDir, getAgentFile, getMemoryDir, getTrashDir, ensureVaultDirs } from './vault.js';
import type { AgentFile, AgentFrontmatter, AgentMode } from '../types/index.js';

export async function listAgents(vaultPath: string): Promise<AgentFile[]> {
  const dir = getAgentsDir(vaultPath);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const agents: AgentFile[] = [];
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    try {
      const agent = await parseAgentFile(join(dir, file));
      agents.push(agent);
    } catch {
      // Skip malformed agent files
    }
  }
  return agents;
}

export async function getAgent(vaultPath: string, name: string): Promise<AgentFile> {
  const filePath = getAgentFile(vaultPath, name);
  return parseAgentFile(filePath);
}

export async function createAgent(
  vaultPath: string,
  name: string,
  mode: AgentMode,
  body: string,
  overrides?: Partial<AgentFrontmatter>,
): Promise<AgentFile> {
  await ensureVaultDirs(vaultPath);
  await mkdir(getMemoryDir(vaultPath, name), { recursive: true });

  const frontmatter: AgentFrontmatter = {
    name,
    type: 'agent',
    execution: buildExecutionConfig(mode, overrides),
    status: 'active',
    memory: { enabled: true },
    created: new Date().toISOString(),
    total_runs: 0,
    total_cost_usd: 0,
    ...stripExecutionOverrides(overrides),
  };

  const agent: AgentFile = { frontmatter, body };
  const filePath = getAgentFile(vaultPath, name);
  await writeAgentFile(filePath, agent);
  return agent;
}

function buildExecutionConfig(
  mode: AgentMode,
  overrides?: Partial<AgentFrontmatter>,
): AgentFrontmatter['execution'] {
  const base: AgentFrontmatter['execution'] = { mode };

  switch (mode) {
    case 'scheduled':
      base.schedule = {
        expression: '0 9 * * *',
        type: 'cron',
        timezone: 'America/Los_Angeles',
        ...overrides?.execution?.schedule,
      };
      break;
    case 'watcher':
      base.watcher = {
        script: `${overrides?.name ?? 'check'}.js`,
        poll_interval_seconds: 300,
        cooldown_seconds: 3600,
        pass_context: true,
        ...overrides?.execution?.watcher,
      };
      break;
    case 'persistent':
      base.persistent = {
        heartbeat_interval_seconds: 1800,
        checkpoint_interval_minutes: 60,
        restart_policy: 'on_failure',
        restart_delay_seconds: 30,
        max_session_duration_hours: 24,
        ...overrides?.execution?.persistent,
      };
      break;
  }

  return base;
}

function stripExecutionOverrides(
  overrides?: Partial<AgentFrontmatter>,
): Partial<AgentFrontmatter> | undefined {
  if (!overrides) return undefined;
  // Remove fields that are handled by buildExecutionConfig
  const { execution, name, ...rest } = overrides;
  return rest;
}

export async function deleteAgent(vaultPath: string, name: string): Promise<void> {
  const filePath = getAgentFile(vaultPath, name);
  const trashDir = getTrashDir(vaultPath);
  await mkdir(trashDir, { recursive: true });
  const trashPath = join(trashDir, `${name}-${Date.now()}.md`);
  await rename(filePath, trashPath);
}
