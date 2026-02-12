import { readdir, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getArchiveDir } from '../core/paths.js';

export interface ArchiveManifest {
  files: Array<{
    filename: string;
    period: string;
    path: string;
  }>;
}

export async function listArchives(cxPath: string, agentName: string): Promise<ArchiveManifest> {
  const dir = getArchiveDir(cxPath, agentName);
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

export async function readArchive(cxPath: string, agentName: string, period: string): Promise<string> {
  const path = join(getArchiveDir(cxPath, agentName), `${period}.md`);
  return readFile(path, 'utf-8');
}

export async function writeArchive(
  cxPath: string,
  agentName: string,
  period: string,
  content: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  const dir = getArchiveDir(cxPath, agentName);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${period}.md`), content);
}
