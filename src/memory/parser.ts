import matter from 'gray-matter';
import type { MemoryFile, MemoryEntry } from '../types/index.js';

export function parseMemoryFile(raw: string): MemoryFile {
  const { data, content } = matter(raw);
  const persistentNotes = extractSection(content, 'Persistent Notes');
  const entries = parseEntries(extractSection(content, 'Recent Entries'));

  return {
    agent_name: data.agent_name ?? '',
    token_count: data.token_count ?? 0,
    last_compacted: data.last_compacted,
    persistent_notes: persistentNotes,
    entries,
  };
}

export function stringifyMemoryFile(mem: MemoryFile): string {
  const frontmatter = {
    agent_name: mem.agent_name,
    token_count: mem.token_count,
    ...(mem.last_compacted ? { last_compacted: mem.last_compacted } : {}),
  };

  let body = '';
  if (mem.persistent_notes) {
    body += `\n# Persistent Notes\n\n${mem.persistent_notes}\n`;
  }
  body += `\n# Recent Entries\n`;
  for (const entry of mem.entries) {
    body += `\n## ${entry.timestamp} [${entry.type}]\n\n${entry.content}\n`;
  }

  return matter.stringify(body, frontmatter);
}

function extractSection(content: string, heading: string): string {
  const marker = `# ${heading}`;
  const start = content.indexOf(marker);
  if (start === -1) return '';
  // Skip past the heading line
  const afterHeading = content.indexOf('\n', start);
  if (afterHeading === -1) return '';
  const rest = content.slice(afterHeading + 1);
  // Find next top-level heading (# ) or end of string
  const nextHeading = rest.search(/^# /m);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  return section.trim();
}

function parseEntries(text: string): MemoryEntry[] {
  if (!text) return [];
  const entries: MemoryEntry[] = [];
  // Split on entry headers, then pair headers with content
  const parts = text.split(/^## /m).filter(Boolean);
  for (const part of parts) {
    const headerMatch = part.match(/^(.+?) \[(.+?)\]\s*\n([\s\S]*)$/);
    if (headerMatch) {
      entries.push({
        timestamp: headerMatch[1]!.trim(),
        type: headerMatch[2]!.trim() as MemoryEntry['type'],
        content: headerMatch[3]!.trim(),
      });
    }
  }
  return entries;
}
