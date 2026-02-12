import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../core/config.js';
import { readHotMemory } from '../../memory/hot.js';
import { listArchives } from '../../memory/warm.js';
import { stringifyMemoryFile } from '../../memory/parser.js';

export const memoryCommand = new Command('memory')
  .description('View agent memory')
  .argument('<name>', 'Agent name')
  .option('--archive', 'List archives instead of current memory')
  .action(async (name: string, opts) => {
    const config = await loadConfig();

    if (opts.archive) {
      const archives = await listArchives(config.cx_path, name);
      if (archives.files.length === 0) {
        console.log(chalk.dim('No archives found.'));
        return;
      }
      console.log(chalk.bold(`\nArchives for ${name}:\n`));
      for (const a of archives.files) {
        console.log(`  ${a.period}  ${chalk.dim(a.path)}`);
      }
    } else {
      const mem = await readHotMemory(config.cx_path, name);
      if (mem.entries.length === 0 && !mem.persistent_notes) {
        console.log(chalk.dim(`No memory for agent: ${name}`));
        return;
      }
      console.log(chalk.bold(`\nMemory: ${name} (${mem.token_count} tokens)\n`));
      console.log(stringifyMemoryFile(mem));
    }
  });
