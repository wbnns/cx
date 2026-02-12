import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../core/config.js';
import { readCostsLedger, aggregateCosts } from '../../storage/cost-tracker.js';
import { formatTable } from '../formatters/table.js';

export const costsCommand = new Command('costs')
  .description('View cost breakdown')
  .option('--period <period>', 'Filter period (e.g., 2024-01)')
  .option('--by <field>', 'Group by: agent, mode, category', 'agent')
  .action(async (opts) => {
    const config = await loadConfig();
    let records = await readCostsLedger(config.cx_path);

    if (opts.period) {
      records = records.filter(r => r.date.startsWith(opts.period));
    }

    if (records.length === 0) {
      console.log(chalk.dim('No cost records found.'));
      return;
    }

    const groupBy = opts.by as 'agent' | 'mode' | 'category';
    const groups = aggregateCosts(records, groupBy);

    const rows = Array.from(groups.entries())
      .sort((a, b) => b[1].total_cost - a[1].total_cost)
      .map(([key, value]) => ({
        name: key,
        runs: String(value.total_runs),
        cost: `$${value.total_cost.toFixed(4)}`,
      }));

    const totalCost = records.reduce((sum, r) => sum + r.cost_usd, 0);

    const table = formatTable([
      { header: groupBy.charAt(0).toUpperCase() + groupBy.slice(1), key: 'name', width: 25 },
      { header: 'Runs', key: 'runs', width: 8, align: 'right' },
      { header: 'Cost', key: 'cost', width: 12, align: 'right' },
    ], rows);

    console.log(chalk.bold('\ncx Costs\n'));
    console.log(table);
    console.log(chalk.dim(`\nTotal: $${totalCost.toFixed(4)}`));
  });
