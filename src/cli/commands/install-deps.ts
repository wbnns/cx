import { Command } from 'commander';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import chalk from 'chalk';
import { loadConfig } from '../../core/config.js';
import { getWatchersDir } from '../../core/vault.js';

const execFileAsync = promisify(execFile);

export const installDepsCommand = new Command('install-deps')
  .description('Install dependencies for watcher scripts')
  .action(async () => {
    const config = await loadConfig();
    const watchersDir = getWatchersDir(config.vault_path);

    let files: string[];
    try {
      files = await readdir(watchersDir);
    } catch {
      console.log(chalk.dim('No watchers directory found.'));
      return;
    }

    const packageJsons = files.filter(f => f.endsWith('.package.json'));
    const requirements = files.filter(f => f.endsWith('.requirements.txt'));

    if (packageJsons.length === 0 && requirements.length === 0) {
      console.log(chalk.dim('No dependency files found in watchers/.'));
      return;
    }

    for (const pj of packageJsons) {
      console.log(chalk.bold(`Installing npm deps: ${pj}`));
      try {
        const { stdout } = await execFileAsync('npm', ['install', '--prefix', watchersDir, '--package-json', join(watchersDir, pj)], {
          timeout: 120000,
        });
        console.log(chalk.green(`  Done.`));
      } catch (err) {
        // Fallback: just run npm install in watchers dir
        try {
          await execFileAsync('npm', ['install'], { cwd: watchersDir, timeout: 120000 });
          console.log(chalk.green(`  Done.`));
        } catch (innerErr) {
          console.error(chalk.red(`  Failed: ${innerErr instanceof Error ? innerErr.message : innerErr}`));
        }
      }
    }

    for (const req of requirements) {
      console.log(chalk.bold(`Installing pip deps: ${req}`));
      try {
        await execFileAsync('pip', ['install', '-r', join(watchersDir, req)], {
          timeout: 120000,
        });
        console.log(chalk.green(`  Done.`));
      } catch (err) {
        // Try pip3
        try {
          await execFileAsync('pip3', ['install', '-r', join(watchersDir, req)], {
            timeout: 120000,
          });
          console.log(chalk.green(`  Done.`));
        } catch (innerErr) {
          console.error(chalk.red(`  Failed: ${innerErr instanceof Error ? innerErr.message : innerErr}`));
        }
      }
    }

    console.log(chalk.green('\nDependency installation complete.'));
  });
