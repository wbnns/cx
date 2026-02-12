import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from './config.js';

export async function getVaultPath(): Promise<string> {
  const config = await loadConfig();
  return config.vault_path;
}

export function getCxRoot(vaultPath: string): string {
  return join(vaultPath, 'cx');
}

export function getAgentsDir(vaultPath: string): string {
  return join(vaultPath, 'cx', 'agents');
}

export function getWatchersDir(vaultPath: string): string {
  return join(vaultPath, 'cx', 'watchers');
}

export function getMemoryDir(vaultPath: string, agentName: string): string {
  return join(vaultPath, 'cx', 'memory', agentName);
}

export function getArchiveDir(vaultPath: string, agentName: string): string {
  return join(vaultPath, 'cx', 'memory', agentName, 'archive');
}

export function getRunsDir(vaultPath: string): string {
  return join(vaultPath, 'cx', 'runs');
}

export function getTemplatesDir(vaultPath: string): string {
  return join(vaultPath, 'cx', '_templates');
}

export function getAgentFile(vaultPath: string, agentName: string): string {
  return join(vaultPath, 'cx', 'agents', `${agentName}.md`);
}

export function getTrashDir(vaultPath: string): string {
  return join(vaultPath, 'cx', '.trash');
}

export function getDashboardFile(vaultPath: string): string {
  return join(vaultPath, 'cx', 'dashboard.md');
}

export function getCostsFile(vaultPath: string): string {
  return join(vaultPath, 'cx', 'costs.md');
}

export async function ensureVaultDirs(vaultPath: string): Promise<void> {
  const dirs = [
    getCxRoot(vaultPath),
    getAgentsDir(vaultPath),
    getWatchersDir(vaultPath),
    join(vaultPath, 'cx', 'memory'),
    getRunsDir(vaultPath),
    getTemplatesDir(vaultPath),
    getTrashDir(vaultPath),
  ];
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
}
