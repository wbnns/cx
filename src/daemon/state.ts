import { readFile, writeFile } from 'node:fs/promises';
import { getStateFile } from '../core/config.js';
import type { DaemonState } from '../types/index.js';

export async function loadDaemonState(): Promise<DaemonState | null> {
  try {
    const raw = await readFile(getStateFile(), 'utf-8');
    return JSON.parse(raw) as DaemonState;
  } catch {
    return null;
  }
}

export async function saveDaemonState(state: DaemonState): Promise<void> {
  await writeFile(getStateFile(), JSON.stringify(state, null, 2));
}

export function createInitialState(): DaemonState {
  return {
    pid: process.pid,
    started_at: new Date().toISOString(),
    agents: {},
  };
}
