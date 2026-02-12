import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { saveConfig, configExists, getConfigDir, getSecretsDir } from '../../core/config.js';
import { ensureVaultDirs } from '../../core/vault.js';
import { mkdir, chmod } from 'node:fs/promises';
import chalk from 'chalk';
import type { CxConfig } from '../../types/index.js';

export const initCommand = new Command('init')
  .description('Initialize cx configuration (run from inside your vault directory)')
  .action(async () => {
    const rl = createInterface({ input: stdin, output: stdout });

    try {
      const exists = await configExists();
      if (exists) {
        const overwrite = await rl.question(chalk.yellow('Config already exists. Overwrite? (y/N) '));
        if (overwrite.toLowerCase() !== 'y') {
          console.log('Aborted.');
          return;
        }
      }

      console.log(chalk.bold('\ncx Setup\n'));

      // Use current working directory as vault path
      const vaultPath = process.cwd();
      console.log(`Vault path: ${chalk.cyan(vaultPath)}`);

      const claudePath = await rl.question('Claude CLI path (default: claude): ') || 'claude';
      const defaultModel = await rl.question('Default model (default: sonnet): ') || 'sonnet';
      const timezone = await rl.question('Timezone (default: America/Los_Angeles): ') || 'America/Los_Angeles';

      const config: CxConfig = {
        vault_path: vaultPath,
        claude_path: claudePath,
        default_model: defaultModel,
        default_permission_mode: 'dangerouslySkipPermissions',
        cx_folder: 'cx',
        timezone,
        daemon: {
          tick_interval_seconds: 30,
          log_file: '~/.config/cx/daemon.log',
        },
        cost_limits: {
          warn_threshold_usd: 10,
          monthly_budget_usd: 100,
          daily_usd: 25,
          alert_thresholds: [5, 10, 25],
        },
        compaction: {
          default_model: 'haiku',
        },
      };

      await saveConfig(config);
      await ensureVaultDirs(config.vault_path);

      // Create secrets directory
      const secretsDir = getSecretsDir();
      await mkdir(secretsDir, { recursive: true });
      await chmod(secretsDir, 0o700);

      console.log(chalk.green('\nConfiguration saved to ' + getConfigDir() + '/config.yaml'));
      console.log(chalk.green('Vault directories created at ' + config.vault_path + '/cx/'));
      console.log(chalk.dim('\nNext: cx create <name> --mode scheduled'));
    } finally {
      rl.close();
    }
  });
