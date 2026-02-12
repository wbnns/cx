import { Command } from 'commander';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { watch } from 'node:fs';
import chalk from 'chalk';
import { loadConfig } from '../../core/config.js';
import { getRunsDir } from '../../core/vault.js';

export const logsCommand = new Command('logs')
  .description('View agent run logs')
  .argument('<name>', 'Agent name')
  .option('--last <n>', 'Show last N logs', '5')
  .option('--output', 'Show full output (not just summary)')
  .option('--follow', 'Watch for new logs')
  .action(async (name: string, opts) => {
    const config = await loadConfig();
    const runsDir = getRunsDir(config.vault_path);
    const lastN = parseInt(opts.last, 10);

    const logFiles = await collectLogFiles(runsDir, name);

    if (logFiles.length === 0) {
      console.log(chalk.dim(`No logs found for agent: ${name}`));
      if (!opts.follow) return;
    }

    const toShow = logFiles.slice(0, lastN);
    for (const log of toShow) {
      await displayLog(log, opts.output);
    }

    if (opts.follow) {
      console.log(chalk.dim('\nWatching for new logs... (Ctrl+C to stop)\n'));
      const watcher = watch(runsDir, { recursive: true }, async (event, filename) => {
        if (!filename || !filename.includes(name) || !filename.endsWith('.md')) return;
        const fullPath = join(runsDir, filename);
        try {
          const log = { path: fullPath, date: '', time: '' };
          await displayLog(log, opts.output);
        } catch {
          // File may not be ready yet
        }
      });
      // Keep process alive
      await new Promise(() => {});
    }
  });

async function collectLogFiles(
  runsDir: string,
  name: string,
): Promise<{ path: string; date: string; time: string }[]> {
  const logFiles: { path: string; date: string; time: string }[] = [];

  let dateDirs: string[];
  try {
    dateDirs = await readdir(runsDir);
  } catch {
    return [];
  }

  for (const dateDir of dateDirs.sort().reverse()) {
    const dirPath = join(runsDir, dateDir);
    let files: string[];
    try {
      files = await readdir(dirPath);
    } catch {
      continue;
    }
    for (const file of files.sort().reverse()) {
      if (file.startsWith(`${name}-`) && file.endsWith('.md')) {
        logFiles.push({
          path: join(dirPath, file),
          date: dateDir,
          time: file.replace(`${name}-`, '').replace('.md', ''),
        });
      }
    }
  }

  return logFiles;
}

async function displayLog(
  log: { path: string; date: string; time: string },
  fullOutput: boolean,
): Promise<void> {
  const content = await readFile(log.path, 'utf-8');
  console.log(chalk.bold(`\n── ${log.date} ${log.time} ──`));
  if (fullOutput) {
    console.log(content);
  } else {
    // Print just the body (skip frontmatter)
    const bodyMatch = content.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
    console.log(bodyMatch?.[1]?.trim() ?? content);
  }
}
