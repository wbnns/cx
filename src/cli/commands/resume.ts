import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../core/config.js';
import { updateAgentFrontmatter } from '../../core/agent-parser.js';
import { getAgentFile } from '../../core/vault.js';
import { sendIpcRequest } from '../ipc-client.js';

export const resumeCommand = new Command('resume')
  .description('Resume a paused agent')
  .argument('<name>', 'Agent name')
  .action(async (name: string) => {
    const config = await loadConfig();
    const filePath = getAgentFile(config.vault_path, name);

    await updateAgentFrontmatter(filePath, { status: 'active' });

    try {
      await sendIpcRequest('resume', { name });
    } catch {
      // Daemon may not be running, that's OK
    }

    console.log(chalk.green(`▶  Resumed agent: ${name}`));
  });
