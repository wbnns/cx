import { describe, it, expect } from 'vitest';
import { parseMemoryFile, stringifyMemoryFile } from '../src/memory/parser.js';
import type { MemoryFile } from '../src/types/index.js';

describe('memory-parser', () => {
  it('creates and parses memory file', () => {
    const mem: MemoryFile = {
      agent_name: 'test',
      token_count: 100,
      persistent_notes: 'Always check the weather first.',
      entries: [
        {
          timestamp: '2024-01-15T10:00:00Z',
          type: 'run_result',
          content: 'Successfully fetched surf report.',
        },
        {
          timestamp: '2024-01-16T10:00:00Z',
          type: 'run_result',
          content: 'Waves are 3-5ft.',
        },
      ],
    };

    const raw = stringifyMemoryFile(mem);
    expect(raw).toContain('agent_name: test');
    expect(raw).toContain('# Persistent Notes');
    expect(raw).toContain('# Recent Entries');
    expect(raw).toContain('Always check the weather first.');
  });

  it('round-trips memory file', () => {
    const mem: MemoryFile = {
      agent_name: 'roundtrip',
      token_count: 50,
      persistent_notes: 'Key fact.',
      entries: [
        {
          timestamp: '2024-01-01T00:00:00Z',
          type: 'note',
          content: 'A note entry.',
        },
      ],
    };

    const raw = stringifyMemoryFile(mem);
    const parsed = parseMemoryFile(raw);
    expect(parsed.agent_name).toBe('roundtrip');
    expect(parsed.persistent_notes).toBe('Key fact.');
    expect(parsed.entries.length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty memory file', () => {
    const mem: MemoryFile = {
      agent_name: 'empty',
      token_count: 0,
      persistent_notes: '',
      entries: [],
    };

    const raw = stringifyMemoryFile(mem);
    const parsed = parseMemoryFile(raw);
    expect(parsed.agent_name).toBe('empty');
    expect(parsed.entries).toHaveLength(0);
  });
});
