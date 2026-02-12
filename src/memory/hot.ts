import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { join } from 'node:path';
import { parseMemoryFile, stringifyMemoryFile } from './parser.js';
import { defaultTokenCounter } from './token-counter.js';
import { getMemoryDir } from '../core/vault.js';
import type { MemoryFile, MemoryEntry } from '../types/index.js';

export function getCurrentMemoryPath(vaultPath: string, agentName: string): string {
  return join(getMemoryDir(vaultPath, agentName), 'current.md');
}

export async function readHotMemory(vaultPath: string, agentName: string): Promise<MemoryFile> {
  const path = getCurrentMemoryPath(vaultPath, agentName);
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

export async function writeHotMemory(vaultPath: string, agentName: string, mem: MemoryFile): Promise<void> {
  const path = getCurrentMemoryPath(vaultPath, agentName);
  await mkdir(dirname(path), { recursive: true });
  const content = stringifyMemoryFile(mem);
  mem.token_count = defaultTokenCounter.count(content);
  const finalContent = stringifyMemoryFile(mem);
  await writeFile(path, finalContent);
}

export async function appendMemoryEntry(
  vaultPath: string,
  agentName: string,
  entry: MemoryEntry,
): Promise<MemoryFile> {
  const mem = await readHotMemory(vaultPath, agentName);
  mem.entries.push(entry);
  const content = stringifyMemoryFile(mem);
  mem.token_count = defaultTokenCounter.count(content);
  await writeHotMemory(vaultPath, agentName, mem);
  return mem;
}
