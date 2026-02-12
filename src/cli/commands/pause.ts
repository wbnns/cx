import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../core/config.js';
import { updateAgentFrontmatter } from '../../core/agent-parser.js';
import { getAgentFile } from '../../core/vault.js';
import { sendIpcRequest } from '../ipc-client.js';

export const pauseCommand = new Command('pause')
  .description('Pause an agent')
  .argument('<name>', 'Agent name')
  .action(async (name: string) => {
    const config = await loadConfig();
    const filePath = getAgentFile(config.vault_path, name);

    await updateAgentFrontmatter(filePath, { status: 'paused' });

    try {
      await sendIpcRequest('pause', { name });
    } catch {
      // Daemon may not be running, that's OK
    }

    console.log(chalk.yellow(`⏸  Paused agent: ${name}`));
  });
