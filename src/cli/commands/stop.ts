import { Command } from 'commander';
import chalk from 'chalk';
import { sendIpcRequest } from '../ipc-client.js';

export const stopCommand = new Command('stop')
  .description('Stop an agent')
  .argument('<name>', 'Agent name')
  .action(async (name: string) => {
    try {
      await sendIpcRequest('stop', { name });
      console.log(chalk.green(`✅ Stopped agent: ${name}`));
    } catch (err) {
      console.error(chalk.red(`Failed to stop agent: ${err instanceof Error ? err.message : err}`));
      process.exit(1);
    }
  });
