import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { getRunsDir } from '../core/paths.js';
import type { RunResult, AgentFrontmatter } from '../types/index.js';

export async function writeRunLog(
  cxPath: string,
  agent: AgentFrontmatter,
  result: RunResult,
): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');
  const dir = join(getRunsDir(cxPath), dateStr);
  await mkdir(dir, { recursive: true });

  const filename = `${agent.name}-${timeStr}.md`;
  const filePath = join(dir, filename);

  const frontmatter: Record<string, unknown> = {
    agent: agent.name,
    mode: agent.execution.mode,
    timestamp: now.toISOString(),
    cost_usd: result.total_cost_usd,
    duration_ms: result.duration_ms,
    is_error: result.is_error,
  };
  if (agent.categories) frontmatter.categories = agent.categories;
  if (agent.model) frontmatter.model = agent.model;
  if (result.session_id) frontmatter.session_id = result.session_id;
  if (result.usage?.input_tokens != null) frontmatter.input_tokens = result.usage.input_tokens;
  if (result.usage?.output_tokens != null) frontmatter.output_tokens = result.usage.output_tokens;

  const body = `\n# Run: ${agent.name}\n\n**Time**: ${now.toISOString()}\n**Duration**: ${(result.duration_ms / 1000).toFixed(1)}s\n**Cost**: $${result.total_cost_usd.toFixed(4)}\n**Status**: ${result.is_error ? 'ERROR' : 'SUCCESS'}\n\n## Result\n\n${result.result}\n`;

  const content = matter.stringify(body, frontmatter);
  await writeFile(filePath, content);
  return filePath;
}
