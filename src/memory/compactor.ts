import { readHotMemory, writeHotMemory } from './hot.js';
import { writeArchive } from './warm.js';
import { defaultTokenCounter } from './token-counter.js';
import { stringifyMemoryFile } from './parser.js';
import { spawnClaude } from '../execution/claude-process.js';
import { getAgent } from '../core/agent.js';
import { loadConfig } from '../core/config.js';
import { getMaxCurrentTokens } from '../core/frontmatter-accessors.js';
import type { MemoryFile } from '../types/index.js';

const DEFAULT_COMPACTION_THRESHOLD = 4000; // tokens

export async function shouldCompact(vaultPath: string, agentName: string): Promise<boolean> {
  const mem = await readHotMemory(vaultPath, agentName);
  let threshold = DEFAULT_COMPACTION_THRESHOLD;
  try {
    const agent = await getAgent(vaultPath, agentName);
    threshold = getMaxCurrentTokens(agent.frontmatter);
  } catch {
    // Use default threshold if agent can't be loaded
  }
  return mem.token_count > threshold;
}

export async function compactMemory(
  vaultPath: string,
  agentName: string,
  claudePath: string,
): Promise<void> {
  const mem = await readHotMemory(vaultPath, agentName);
  if (mem.entries.length < 2) return;

  // Determine compaction model from config
  let compactionModel = 'haiku';
  try {
    const config = await loadConfig();
    compactionModel = config.compaction?.default_model ?? 'haiku';
  } catch {
    // Use default
  }

  // Keep the most recent entry, summarize the rest
  const toSummarize = mem.entries.slice(0, -1);
  const keep = mem.entries.slice(-1);

  const entriesText = toSummarize
    .map(e => `## ${e.timestamp} [${e.type}]\n${e.content}`)
    .join('\n\n');

  const prompt = `Summarize the following agent memory entries into a concise summary. Preserve key facts, decisions, and outcomes. Remove redundant details. Output only the summary, no preamble.\n\n${entriesText}`;

  const result = await spawnClaude({
    claudePath,
    prompt,
    model: compactionModel,
    maxBudget: 0.05,
    systemPrompt: 'You are a memory compaction assistant. Summarize concisely while preserving important information.',
  });

  // Write archive
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const archiveContent = `# Archive: ${period}\n\nCompacted: ${new Date().toISOString()}\n\n## Summary\n\n${result.result}\n\n## Original Entries\n\n${entriesText}`;
  await writeArchive(vaultPath, agentName, `${period}-${Date.now()}`, archiveContent);

  // Rewrite current.md with summary + kept entries
  const newMem: MemoryFile = {
    agent_name: agentName,
    token_count: 0,
    last_compacted: new Date().toISOString(),
    persistent_notes: mem.persistent_notes,
    entries: [
      {
        timestamp: new Date().toISOString(),
        type: 'compaction',
        content: result.result,
      },
      ...keep,
    ],
  };
  newMem.token_count = defaultTokenCounter.count(stringifyMemoryFile(newMem));
  await writeHotMemory(vaultPath, agentName, newMem);
}
