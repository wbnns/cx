import { readdir, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getArchiveDir } from '../core/vault.js';

export interface ArchiveManifest {
  files: Array<{
    filename: string;
    period: string;
    path: string;
  }>;
}

export async function listArchives(vaultPath: string, agentName: string): Promise<ArchiveManifest> {
  const dir = getArchiveDir(vaultPath, agentName);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return { files: [] };
  }
  return {
    files: files
      .filter(f => f.endsWith('.md'))
      .sort()
      .map(f => ({
        filename: f,
        period: f.replace('.md', ''),
        path: join(dir, f),
      })),
  };
}

export async function readArchive(vaultPath: string, agentName: string, period: string): Promise<string> {
  const path = join(getArchiveDir(vaultPath, agentName), `${period}.md`);
  return readFile(path, 'utf-8');
}

export async function writeArchive(
  vaultPath: string,
  agentName: string,
  period: string,
  content: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  const dir = getArchiveDir(vaultPath, agentName);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${period}.md`), content);
}
