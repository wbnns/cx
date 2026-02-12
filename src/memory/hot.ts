import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { join } from 'node:path';
import { parseMemoryFile, stringifyMemoryFile } from './parser.js';
import { defaultTokenCounter } from './token-counter.js';
import { getMemoryDir } from '../core/paths.js';
import type { MemoryFile, MemoryEntry } from '../types/index.js';

export function getCurrentMemoryPath(cxPath: string, agentName: string): string {
  return join(getMemoryDir(cxPath, agentName), 'current.md');
}

export async function readHotMemory(cxPath: string, agentName: string): Promise<MemoryFile> {
  const path = getCurrentMemoryPath(cxPath, agentName);
  try {
    const raw = await readFile(path, 'utf-8');
    return parseMemoryFile(raw);
  } catch {
    return {
      agent_name: agentName,
      token_count: 0,
      persistent_notes: '',
      entries: [],
    };
  }
}

export async function writeHotMemory(cxPath: string, agentName: string, mem: MemoryFile): Promise<void> {
  const path = getCurrentMemoryPath(cxPath, agentName);
  await mkdir(dirname(path), { recursive: true });
  const content = stringifyMemoryFile(mem);
  mem.token_count = defaultTokenCounter.count(content);
  const finalContent = stringifyMemoryFile(mem);
  await writeFile(path, finalContent);
}

export async function appendMemoryEntry(
  cxPath: string,
  agentName: string,
  entry: MemoryEntry,
): Promise<MemoryFile> {
  const mem = await readHotMemory(cxPath, agentName);
  mem.entries.push(entry);
  const content = stringifyMemoryFile(mem);
  mem.token_count = defaultTokenCounter.count(content);
  await writeHotMemory(cxPath, agentName, mem);
  return mem;
}
