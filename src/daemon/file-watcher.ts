import { watch } from 'chokidar';
import type { FSWatcher } from 'chokidar';
import { parseAgentFile } from '../core/agent-parser.js';
import { getAgentsDir } from '../core/paths.js';
import type { AgentFile } from '../types/index.js';

export type AgentChangeCallback = (event: 'add' | 'change' | 'unlink', name: string, agent?: AgentFile) => void;

let watcher: FSWatcher | null = null;

export function startFileWatcher(cxPath: string, callback: AgentChangeCallback): void {
  const agentsDir = getAgentsDir(cxPath);

  watcher = watch(`${agentsDir}/*.md`, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });

  watcher.on('add', async (filePath) => {
    const name = extractName(filePath);
    if (!name) return;
    try {
      const agent = await parseAgentFile(filePath);
      callback('add', name, agent);
    } catch {
      // Ignore parse errors on add
    }
  });

  watcher.on('change', async (filePath) => {
    const name = extractName(filePath);
    if (!name) return;
    try {
      const agent = await parseAgentFile(filePath);
      callback('change', name, agent);
    } catch {
      // Ignore parse errors on change
    }
  });

  watcher.on('unlink', (filePath) => {
    const name = extractName(filePath);
    if (!name) return;
    callback('unlink', name);
  });
}

export async function stopFileWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
}

function extractName(filePath: string): string | undefined {
  const match = filePath.match(/([^/\\]+)\.md$/);
  return match?.[1];
}
