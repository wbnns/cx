import { readHotMemory } from '../memory/hot.js';
import { listArchives, readArchive } from '../memory/warm.js';
import type { AgentFile } from '../types/index.js';

export interface ContextBuildOptions {
  agent: AgentFile;
  cxPath: string;
  watcherContext?: string;
  includeArchives?: boolean;
  maxArchives?: number;
}

export async function buildContext(opts: ContextBuildOptions): Promise<string> {
  const parts: string[] = [];

  // 1. Agent instructions (body)
  if (opts.agent.body) {
    parts.push(opts.agent.body);
  }

  // 2. Hot memory
  const hotMemory = await readHotMemory(opts.cxPath, opts.agent.frontmatter.name);
  if (hotMemory.persistent_notes) {
    parts.push(`## Persistent Notes\n\n${hotMemory.persistent_notes}`);
  }
  if (hotMemory.entries.length > 0) {
    const recentEntries = hotMemory.entries
      .slice(-5) // Last 5 entries
      .map(e => `### ${e.timestamp} [${e.type}]\n${e.content}`)
      .join('\n\n');
    parts.push(`## Recent Memory\n\n${recentEntries}`);
  }

  // 3. Archive summaries (if requested)
  if (opts.includeArchives) {
    const archives = await listArchives(opts.cxPath, opts.agent.frontmatter.name);
    const maxArchives = opts.maxArchives ?? 3;
    const recent = archives.files.slice(-maxArchives);
    for (const archive of recent) {
      try {
        const content = await readArchive(opts.cxPath, opts.agent.frontmatter.name, archive.period);
        parts.push(`## Archive: ${archive.period}\n\n${content}`);
      } catch {
        // Skip unreadable archives
      }
    }
  }

  // 4. Watcher context
  if (opts.watcherContext) {
    parts.push(`## Watcher Context\n\n${opts.watcherContext}`);
  }

  return parts.join('\n\n---\n\n');
}
