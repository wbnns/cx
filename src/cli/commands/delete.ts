import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { unlink, rm } from 'node:fs/promises';
import chalk from 'chalk';
import { loadConfig } from '../../core/config.js';
import { deleteAgent, getAgent } from '../../core/agent.js';
import { getMemoryDir } from '../../core/paths.js';

export const deleteCommand = new Command('delete')
  .description('Delete an agent')
  .argument('<name>', 'Agent name')
  .option('-f, --force', 'Skip confirmation')
  .action(async (name: string, opts) => {
    const config = await loadConfig();

    try {
      await getAgent(config.cx_path, name);
    } catch {
      console.error(chalk.red(`Agent not found: ${name}`));
      process.exit(1);
    }

    if (!opts.force) {
      const rl = createInterface({ input: stdin, output: stdout });
      console.log(chalk.yellow(`\nDelete agent "${name}"?\n`));
      console.log('  [d] Delete agent file only (move to .trash/)');
      console.log('  [a] Delete agent + all data (memory, logs)');
      console.log('  [c] Cancel\n');
      const answer = await rl.question('Choice: ');
      rl.close();

      const choice = answer.toLowerCase().trim();
      if (choice === 'c' || (!choice)) {
        console.log('Aborted.');
        return;
      }

      if (choice === 'a') {
        // Delete agent file (moves to trash) + remove memory dir
        await deleteAgent(config.cx_path, name);
        try {
          await rm(getMemoryDir(config.cx_path, name), { recursive: true, force: true });
        } catch {
          // Memory dir may not exist
        }
        console.log(chalk.green(`Deleted agent and all data: ${name}`));
        return;
      }

      // choice === 'd' or anything else — just move agent to trash
      await deleteAgent(config.cx_path, name);
      console.log(chalk.green(`Deleted agent: ${name} (moved to .trash/)`));
      return;
    }

    // Force mode — just move to trash
    await deleteAgent(config.cx_path, name);
    console.log(chalk.green(`Deleted agent: ${name}`));
  });
