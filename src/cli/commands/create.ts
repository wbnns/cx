import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../core/config.js';
import { createAgent } from '../../core/agent.js';
import { getAgentFile } from '../../core/paths.js';
import type { AgentMode, AgentFrontmatter } from '../../types/index.js';

const TEMPLATES: Record<string, string> = {
  scheduled: `# Agent Instructions

You are an automated agent. Follow these instructions for each scheduled run.

## Task

Describe what this agent should do on each run.

## Output Format

Describe expected output format.
`,
  watcher: `# Agent Instructions

You are a watcher agent. You will be triggered when your watch condition is met.

## Task

Describe what this agent should do when triggered.

## Context Usage

The watcher context will be provided with trigger details.
`,
  persistent: `# Agent Instructions

You are a persistent agent maintaining long-running state.

## Ongoing Task

Describe the ongoing task this agent manages.

## Checkpoint Instructions

On checkpoint, summarize your current state and progress.
`,
};

export const createCommand = new Command('create')
  .description('Create a new agent')
  .argument('<name>', 'Agent name')
  .option('--mode <mode>', 'Agent mode (scheduled|watcher|persistent)', 'scheduled')
  .option('--category <categories>', 'Agent categories (comma-separated)')
  .option('--schedule <cron>', 'Cron schedule (scheduled mode)')
  .option('--model <model>', 'Model override')
  .action(async (name: string, opts) => {
    const config = await loadConfig();
    const mode = opts.mode as AgentMode;

    const overrides: Partial<AgentFrontmatter> = {};
    if (opts.category) {
      overrides.categories = (opts.category as string).split(',').map((c: string) => c.trim());
    }
    if (opts.schedule) {
      overrides.execution = {
        mode,
        schedule: { expression: opts.schedule },
      };
    }
    if (opts.model) overrides.model = opts.model;

    // For watcher mode, set a default watch_script
    if (mode === 'watcher' && !overrides.execution?.watcher?.script) {
      overrides.execution = {
        mode,
        watcher: { script: `${name}.js` },
      };
    }

    const body = TEMPLATES[mode] ?? TEMPLATES.scheduled!;
    const agent = await createAgent(config.cx_path, name, mode, body, overrides);
    const filePath = getAgentFile(config.cx_path, name);

    console.log(chalk.green(`Created ${mode} agent: ${name}`));
    console.log(chalk.dim(`   File: ${filePath}`));
    console.log(chalk.dim(`   Edit with: cx edit ${name}`));
  });
