import { Command } from 'commander';
import { fork } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { loadConfig } from '../../core/config.js';
import { getAgent } from '../../core/agent.js';
import { getWatchersDir } from '../../core/vault.js';
import { getWatchScript, getTriggerCondition } from '../../core/frontmatter-accessors.js';
import { evaluateTriggerCondition } from '../../daemon/modes/watcher.js';

export const testWatcherCommand = new Command('test-watcher')
  .description('Test a watcher agent\'s check script')
  .argument('<name>', 'Agent name')
  .action(async (name: string) => {
    const config = await loadConfig();
    const agent = await getAgent(config.vault_path, name);
    const fm = agent.frontmatter;

    if (fm.execution.mode !== 'watcher') {
      console.error(chalk.red(`Agent "${name}" is not a watcher agent (mode: ${fm.execution.mode})`));
      process.exit(1);
    }

    const scriptName = getWatchScript(fm);
    if (!scriptName) {
      console.error(chalk.red(`Agent "${name}" has no watcher script configured.`));
      process.exit(1);
    }

    const scriptPath = join(getWatchersDir(config.vault_path), scriptName);
    console.log(chalk.bold(`Testing watcher: ${name}`));
    console.log(chalk.dim(`Script: ${scriptPath}\n`));

    // Run the watcher script
    const harnessPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'daemon', 'watcher-harness.js');

    const result = await new Promise<{ triggered: boolean; context?: Record<string, unknown>; error?: string }>((resolve) => {
      const child = fork(harnessPath, [scriptPath], {
        timeout: 30000,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });

      let stdout = '';
      child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      let stderr = '';
      child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      child.on('message', (msg: unknown) => {
        resolve(msg as { triggered: boolean; context?: Record<string, unknown>; error?: string });
      });

      child.on('exit', (code) => {
        if (code !== 0) {
          resolve({ triggered: false, error: `Script exited with code ${code}: ${stderr || stdout}` });
        }
      });

      child.on('error', (err) => {
        resolve({ triggered: false, error: err.message });
      });

      setTimeout(() => {
        child.kill('SIGKILL');
        resolve({ triggered: false, error: 'Script timed out' });
      }, 30000);
    });

    // Display results
    if (result.error) {
      console.log(chalk.red(`Error: ${result.error}`));
      return;
    }

    console.log(chalk.bold('Result:'));
    console.log(`  triggered: ${result.triggered ? chalk.green('true') : chalk.dim('false')}`);
    if (result.context) {
      console.log(`  context: ${JSON.stringify(result.context, null, 2)}`);
    }

    // Evaluate trigger condition
    const condition = getTriggerCondition(fm);
    if (condition && result.context) {
      const conditionResult = evaluateTriggerCondition(condition, result.context);
      console.log(`\n${chalk.bold('Trigger condition')}: ${condition}`);
      console.log(`  result: ${conditionResult ? chalk.green('WOULD TRIGGER') : chalk.dim('would NOT trigger')}`);
    } else if (result.triggered) {
      console.log(chalk.green('\nAgent WOULD be triggered.'));
    } else {
      console.log(chalk.dim('\nAgent would NOT be triggered.'));
    }
  });
