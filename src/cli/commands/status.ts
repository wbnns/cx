import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../core/config.js';
import { listAgents } from '../../core/agent.js';
import { statusColor, modeColor } from '../formatters/table.js';

export const statusCommand = new Command('status')
  .description('Quick status overview')
  .action(async () => {
    const config = await loadConfig();
    const agents = await listAgents(config.vault_path);

    if (agents.length === 0) {
      console.log(chalk.dim('No agents configured.'));
      return;
    }

    const byStatus = { active: 0, paused: 0, stopped: 0, failed: 0 };
    const byMode = { scheduled: 0, watcher: 0, persistent: 0 };

    for (const a of agents) {
      byStatus[a.frontmatter.status]++;
      byMode[a.frontmatter.execution.mode]++;
    }

    console.log(chalk.bold('\ncx Agent Status\n'));
    console.log(`  Total: ${chalk.bold(String(agents.length))}`);
    console.log(`  ${statusColor('active')}: ${byStatus.active}  ${statusColor('paused')}: ${byStatus.paused}  ${statusColor('failed')}: ${byStatus.failed}`);
    console.log(`  ${modeColor('scheduled')}: ${byMode.scheduled}  ${modeColor('watcher')}: ${byMode.watcher}  ${modeColor('persistent')}: ${byMode.persistent}`);
    console.log();

    // Show agents with failures
    const failedAgents = agents.filter(a => a.frontmatter.status === 'failed');
    if (failedAgents.length > 0) {
      console.log(chalk.red.bold('  Agents with failures:'));
      for (const a of failedAgents) {
        console.log(chalk.red(`    - ${a.frontmatter.name}: ${a.frontmatter.last_status ?? 'unknown'}`));
      }
      console.log();
    }
  });
