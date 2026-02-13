import { Command } from 'commander';
import { fork } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { realpathSync, watch } from 'node:fs';
import { join, dirname } from 'node:path';
import chalk from 'chalk';
import { getPidFile, getSocketPath, getDaemonLogFile, loadConfig } from '../../core/config.js';

export const daemonCommand = new Command('daemon')
  .description('Manage the cx daemon');

daemonCommand
  .command('start')
  .description('Start the daemon')
  .action(async () => {
    const pid = await getDaemonPid();
    if (pid && isProcessRunning(pid)) {
      console.log(chalk.yellow(`Daemon already running (PID: ${pid})`));
      return;
    }

    // Find the daemon entry point relative to this file
    const daemonPath = join(dirname(dirname(realpathSync(process.argv[1]))), 'daemon', 'index.js');

    const child = fork(daemonPath, [], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    console.log(chalk.green(`Daemon started (PID: ${child.pid})`));
  });

daemonCommand
  .command('stop')
  .description('Stop the daemon')
  .action(async () => {
    const pid = await getDaemonPid();
    if (!pid) {
      console.log(chalk.dim('Daemon is not running.'));
      return;
    }

    try {
      process.kill(pid, 'SIGTERM');
      console.log(chalk.green(`Daemon stopped (PID: ${pid})`));
    } catch {
      console.log(chalk.dim('Daemon process not found. Cleaning up.'));
    }

    // Clean up PID file and socket
    try { await unlink(getPidFile()); } catch {}
    try { await unlink(getSocketPath()); } catch {}
  });

daemonCommand
  .command('restart')
  .description('Restart the daemon')
  .action(async () => {
    // Stop first
    const pid = await getDaemonPid();
    if (pid && isProcessRunning(pid)) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {}
      // Wait a moment for clean shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    try { await unlink(getPidFile()); } catch {}
    try { await unlink(getSocketPath()); } catch {}

    // Start
    const daemonPath = join(dirname(dirname(realpathSync(process.argv[1]))), 'daemon', 'index.js');
    const child = fork(daemonPath, [], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    console.log(chalk.green(`Daemon restarted (PID: ${child.pid})`));
  });

daemonCommand
  .command('status')
  .description('Check daemon status')
  .action(async () => {
    const pid = await getDaemonPid();
    if (pid && isProcessRunning(pid)) {
      console.log(chalk.green(`Daemon running (PID: ${pid})`));
    } else {
      console.log(chalk.dim('Daemon is not running.'));
    }
  });

daemonCommand
  .command('logs')
  .description('View daemon logs')
  .option('--follow', 'Follow log output')
  .action(async (opts) => {
    let logFile: string;
    try {
      const config = await loadConfig();
      logFile = getDaemonLogFile(config);
    } catch {
      logFile = getDaemonLogFile();
    }

    // Expand ~ in path
    logFile = logFile.replace(/^~/, process.env.HOME ?? '');

    try {
      const content = await readFile(logFile, 'utf-8');
      // Show last 50 lines
      const lines = content.split('\n');
      const lastLines = lines.slice(-50);
      console.log(lastLines.join('\n'));
    } catch {
      console.log(chalk.dim('No daemon logs found.'));
      return;
    }

    if (opts.follow) {
      console.log(chalk.dim('\nFollowing logs... (Ctrl+C to stop)\n'));
      watch(logFile, async () => {
        try {
          const content = await readFile(logFile, 'utf-8');
          const lines = content.split('\n');
          // Just show the last line on each change
          const last = lines[lines.length - 2]; // -2 because last is empty
          if (last) console.log(last);
        } catch {}
      });
      await new Promise(() => {});
    }
  });

async function getDaemonPid(): Promise<number | null> {
  try {
    const raw = await readFile(getPidFile(), 'utf-8');
    return parseInt(raw.trim(), 10);
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
