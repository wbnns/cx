import { describe, it, expect } from 'vitest';
import { buildContext } from '../src/execution/context-builder.js';
import type { AgentFile } from '../src/types/index.js';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('context-builder', () => {
  it('includes agent body in context', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cx-test-'));
    await mkdir(join(tmpDir, 'cx', 'memory', 'test'), { recursive: true });

    const agent: AgentFile = {
      frontmatter: {
        name: 'test',
        execution: {
          mode: 'scheduled',
          schedule: { expression: '0 9 * * *' },
        },
        status: 'active',
      },
      body: '# Do the thing\n\nInstructions here.',
    };

    const context = await buildContext({ agent, cxPath: tmpDir });
    expect(context).toContain('# Do the thing');
    expect(context).toContain('Instructions here.');
  });

  it('includes watcher context when provided', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cx-test-'));
    await mkdir(join(tmpDir, 'cx', 'memory', 'test'), { recursive: true });

    const agent: AgentFile = {
      frontmatter: {
        name: 'test',
        execution: {
          mode: 'watcher',
          watcher: { script: 'check.js' },
        },
        status: 'active',
      },
      body: 'Watcher instructions.',
    };

    const context = await buildContext({
      agent,
      cxPath: tmpDir,
      watcherContext: '{"file_changed": true}',
    });
    expect(context).toContain('Watcher instructions.');
    expect(context).toContain('Watcher Context');
    expect(context).toContain('file_changed');
  });
});
