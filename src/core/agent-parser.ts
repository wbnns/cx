import matter from 'gray-matter';
import { readFile, writeFile } from 'node:fs/promises';
import { agentFrontmatterSchema } from './agent-schema.js';
import type { AgentFile, AgentFrontmatter } from '../types/index.js';

export async function parseAgentFile(filePath: string): Promise<AgentFile> {
  const raw = await readFile(filePath, 'utf-8');
  return parseAgentString(raw);
}

export function parseAgentString(raw: string): AgentFile {
  const { data, content } = matter(raw);
  const frontmatter = agentFrontmatterSchema.parse(data) as unknown as AgentFrontmatter;
  return { frontmatter, body: content.trim() };
}

export function stringifyAgent(agent: AgentFile): string {
  return matter.stringify('\n' + agent.body + '\n', agent.frontmatter);
}

export async function writeAgentFile(filePath: string, agent: AgentFile): Promise<void> {
  const content = stringifyAgent(agent);
  await writeFile(filePath, content);
}

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];
    if (
      sourceVal !== null &&
      sourceVal !== undefined &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      targetVal !== undefined &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal, sourceVal);
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}

export async function updateAgentFrontmatter(
  filePath: string,
  updates: Partial<AgentFrontmatter>,
): Promise<AgentFile> {
  const agent = await parseAgentFile(filePath);
  agent.frontmatter = deepMerge(
    agent.frontmatter as unknown as Record<string, any>,
    updates as unknown as Record<string, any>,
  ) as unknown as AgentFrontmatter;
  await writeAgentFile(filePath, agent);
  return agent;
}
