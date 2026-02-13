import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { createCommand } from './commands/create.js';
import { editCommand } from './commands/edit.js';
import { deleteCommand } from './commands/delete.js';
import { statusCommand } from './commands/status.js';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { pauseCommand } from './commands/pause.js';
import { resumeCommand } from './commands/resume.js';
import { logsCommand } from './commands/logs.js';
import { memoryCommand } from './commands/memory-cmd.js';
import { compactCommand } from './commands/compact.js';
import { daemonCommand } from './commands/daemon.js';
import { secretsCommand } from './commands/secrets.js';
import { installDepsCommand } from './commands/install-deps.js';
import { testWatcherCommand } from './commands/test-watcher.js';

export function createProgram(): Command {
  const program = new Command('cx')
    .version('1.0.0')
    .description('cx — Claude Code agent management system');

  program.addCommand(initCommand);
  program.addCommand(listCommand);
  program.addCommand(createCommand);
  program.addCommand(editCommand);
  program.addCommand(deleteCommand);
  program.addCommand(statusCommand);
  program.addCommand(startCommand);
  program.addCommand(stopCommand);
  program.addCommand(pauseCommand);
  program.addCommand(resumeCommand);
  program.addCommand(logsCommand);
  program.addCommand(memoryCommand);
  program.addCommand(compactCommand);
  program.addCommand(daemonCommand);
  program.addCommand(secretsCommand);
  program.addCommand(installDepsCommand);
  program.addCommand(testWatcherCommand);

  return program;
}
