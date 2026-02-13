import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../core/config.js';
import { listAgents } from '../../core/agent.js';
import { formatTable, statusColor, modeColor } from '../formatters/table.js';

export const listCommand = new Command('list')
  .description('List all agents')
  .option('--mode <mode>', 'Filter by mode')
  .option('--category <category>', 'Filter by category')
  .option('--status <status>', 'Filter by status')
  .action(async (opts) => {
    const config = await loadConfig();
    let agents = await listAgents(config.cx_path);

    if (opts.mode) agents = agents.filter(a => a.frontmatter.execution.mode === opts.mode);
    if (opts.category) agents = agents.filter(a => a.frontmatter.categories?.includes(opts.category));
    if (opts.status) agents = agents.filter(a => a.frontmatter.status === opts.status);

    if (agents.length === 0) {
      console.log(chalk.dim('No agents found.'));
      return;
    }

    const rows = agents.map(a => ({
      name: a.frontmatter.name,
      mode: a.frontmatter.execution.mode,
      status: a.frontmatter.status,
      schedule: a.frontmatter.execution.schedule?.expression ?? '-',
      last_run: a.frontmatter.last_run ? new Date(a.frontmatter.last_run).toLocaleString() : '-',
      runs: String(a.frontmatter.total_runs ?? 0),
    }));

    const table = formatTable([
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Mode', key: 'mode', width: 12, color: (v) => modeColor(v.trim()) },
      { header: 'Status', key: 'status', width: 10, color: (v) => statusColor(v.trim()) },
      { header: 'Schedule', key: 'schedule', width: 15 },
      { header: 'Last Run', key: 'last_run', width: 20 },
      { header: 'Runs', key: 'runs', width: 6, align: 'right' },
    ], rows);

    console.log(table);
  });
