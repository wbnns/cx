import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { loadConfig } from '../../core/config.js';
import { getAgentFile } from '../../core/vault.js';
import chalk from 'chalk';

export const editCommand = new Command('edit')
  .description('Open agent file in $EDITOR')
  .argument('<name>', 'Agent name')
  .action(async (name: string) => {
    const config = await loadConfig();
    const filePath = getAgentFile(config.vault_path, name);

    const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
    const child = spawn(editor, [filePath], { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) {
        console.log(chalk.green(`✅ Saved ${name}`));
      }
    });
  });
