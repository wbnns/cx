import { Command } from 'commander';
import chalk from 'chalk';
import { sendIpcRequest } from '../ipc-client.js';
import { loadConfig } from '../../core/config.js';
import { readHotMemory } from '../../memory/hot.js';
import { getMaxCurrentTokens } from '../../core/frontmatter-accessors.js';
import { getAgent } from '../../core/agent.js';

export const compactCommand = new Command('compact')
  .description('Force memory compaction')
  .argument('<name>', 'Agent name')
  .option('--all', 'Compact all agents')
  .option('--dry-run', 'Show what would be compacted without doing it')
  .action(async (name: string, opts) => {
    if (opts.dryRun) {
      const config = await loadConfig();
      const agent = await getAgent(config.vault_path, name);
      const mem = await readHotMemory(config.vault_path, name);
      const threshold = getMaxCurrentTokens(agent.frontmatter);
      console.log(`Agent: ${name}`);
      console.log(`Current tokens: ${mem.token_count}`);
      console.log(`Threshold: ${threshold}`);
      console.log(`Entries: ${mem.entries.length}`);
      if (mem.token_count > threshold) {
        console.log(chalk.yellow(`Would compact: ${mem.entries.length - 1} entries would be summarized.`));
      } else {
        console.log(chalk.dim('No compaction needed.'));
      }
      return;
    }

    try {
      await sendIpcRequest('compact', { name, all: opts.all });
      console.log(chalk.green(`Compaction triggered for: ${opts.all ? 'all agents' : name}`));
    } catch (err) {
      console.error(chalk.red(`Failed: ${err instanceof Error ? err.message : err}`));
      console.error(chalk.dim('Is the daemon running? Try: cx daemon start'));
      process.exit(1);
    }
  });
