import { Command } from 'commander';
import chalk from 'chalk';
import { sendIpcRequest } from '../ipc-client.js';

export const startCommand = new Command('start')
  .description('Start/trigger an agent')
  .argument('<name>', 'Agent name')
  .option('--verbose', 'Show verbose output')
  .action(async (name: string, opts) => {
    try {
      const result = await sendIpcRequest('start', { name, verbose: opts.verbose ?? false });
      console.log(chalk.green(`Started agent: ${name}`));
      if (result && typeof result === 'object' && 'message' in result) {
        console.log(chalk.dim(`   ${(result as { message: string }).message}`));
      }
    } catch (err) {
      console.error(chalk.red(`Failed to start agent: ${err instanceof Error ? err.message : err}`));
      console.error(chalk.dim('Is the daemon running? Try: cx daemon start'));
      process.exit(1);
    }
  });
