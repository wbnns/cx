import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from './config.js';

export async function getCxPath(): Promise<string> {
  const config = await loadConfig();
  return config.cx_path;
}

export function getCxRoot(cxPath: string): string {
  return join(cxPath, 'cx');
}

export function getAgentsDir(cxPath: string): string {
  return join(cxPath, 'cx', 'agents');
}

export function getWatchersDir(cxPath: string): string {
  return join(cxPath, 'cx', 'watchers');
}

export function getMemoryDir(cxPath: string, agentName: string): string {
  return join(cxPath, 'cx', 'memory', agentName);
}

export function getArchiveDir(cxPath: string, agentName: string): string {
  return join(cxPath, 'cx', 'memory', agentName, 'archive');
}

export function getRunsDir(cxPath: string): string {
  return join(cxPath, 'cx', 'runs');
}

export function getTemplatesDir(cxPath: string): string {
  return join(cxPath, 'cx', '_templates');
}

export function getAgentFile(cxPath: string, agentName: string): string {
  return join(cxPath, 'cx', 'agents', `${agentName}.md`);
}

export function getTrashDir(cxPath: string): string {
  return join(cxPath, 'cx', '.trash');
}

export function getDashboardFile(cxPath: string): string {
  return join(cxPath, 'cx', 'dashboard.md');
}

export function getCostsFile(cxPath: string): string {
  return join(cxPath, 'cx', 'costs.md');
}

export async function ensureCxDirs(cxPath: string): Promise<void> {
  const dirs = [
    getCxRoot(cxPath),
    getAgentsDir(cxPath),
    getWatchersDir(cxPath),
    join(cxPath, 'cx', 'memory'),
    getRunsDir(cxPath),
    getTemplatesDir(cxPath),
    getTrashDir(cxPath),
  ];
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
}
