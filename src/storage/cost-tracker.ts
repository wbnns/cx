import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getCxRoot } from '../core/paths.js';
import { updateAgentFrontmatter } from '../core/agent-parser.js';
import { getAgentFile } from '../core/paths.js';
import type { CostRecord, RunResult, AgentFrontmatter } from '../types/index.js';

export async function recordCost(
  cxPath: string,
  agent: AgentFrontmatter,
  result: RunResult,
): Promise<void> {
  const record: CostRecord = {
    date: new Date().toISOString(),
    agent: agent.name,
    mode: agent.execution.mode,
    categories: agent.categories,
    cost_usd: result.total_cost_usd,
    input_tokens: result.usage?.input_tokens ?? 0,
    output_tokens: result.usage?.output_tokens ?? 0,
    duration_ms: result.duration_ms,
  };

  // Append to costs.md ledger
  await appendToCostsLedger(cxPath, record);

  // Update agent frontmatter stats
  const agentPath = getAgentFile(cxPath, agent.name);
  await updateAgentFrontmatter(agentPath, {
    total_runs: (agent.total_runs ?? 0) + 1,
    total_cost_usd: (agent.total_cost_usd ?? 0) + result.total_cost_usd,
    last_run: new Date().toISOString(),
    last_status: result.is_error ? 'failed' : 'success',
  });
}

async function appendToCostsLedger(cxPath: string, record: CostRecord): Promise<void> {
  const costsPath = join(getCxRoot(cxPath), 'costs.md');
  const categoryStr = record.categories?.join(',') ?? '-';
  const line = `| ${record.date.slice(0, 19)} | ${record.agent} | ${record.mode} | ${categoryStr} | $${record.cost_usd.toFixed(4)} | ${record.input_tokens} | ${record.output_tokens} | ${(record.duration_ms / 1000).toFixed(1)}s |\n`;

  try {
    await readFile(costsPath, 'utf-8');
    await appendFile(costsPath, line);
  } catch {
    const header = `# cx Cost Ledger\n\n| Timestamp | Agent | Mode | Categories | Cost | Input Tokens | Output Tokens | Duration |\n|-----------|-------|------|------------|------|-------------|--------------|----------|\n`;
    await writeFile(costsPath, header + line);
  }
}

export async function readCostsLedger(cxPath: string): Promise<CostRecord[]> {
  const costsPath = join(getCxRoot(cxPath), 'costs.md');
  let raw: string;
  try {
    raw = await readFile(costsPath, 'utf-8');
  } catch {
    return [];
  }

  const records: CostRecord[] = [];
  const lines = raw.split('\n');
  for (const line of lines) {
    if (!line.startsWith('|') || line.startsWith('| Timestamp') || line.startsWith('|---')) continue;
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 8) continue;
    try {
      const catStr = cells[3]!;
      records.push({
        date: cells[0]!,
        agent: cells[1]!,
        mode: cells[2]! as CostRecord['mode'],
        categories: catStr === '-' ? undefined : catStr.split(','),
        cost_usd: parseFloat(cells[4]!.replace('$', '')),
        input_tokens: parseInt(cells[5]!, 10),
        output_tokens: parseInt(cells[6]!, 10),
        duration_ms: parseFloat(cells[7]!.replace('s', '')) * 1000,
      });
    } catch {
      // Skip malformed lines
    }
  }
  return records;
}

export function aggregateCosts(
  records: CostRecord[],
  groupBy: 'agent' | 'mode' | 'category',
): Map<string, { total_cost: number; total_runs: number }> {
  const groups = new Map<string, { total_cost: number; total_runs: number }>();
  for (const record of records) {
    let keys: string[];
    if (groupBy === 'category') {
      keys = record.categories?.length ? record.categories : ['uncategorized'];
    } else {
      keys = [record[groupBy]];
    }
    for (const key of keys) {
      const existing = groups.get(key) ?? { total_cost: 0, total_runs: 0 };
      existing.total_cost += record.cost_usd;
      existing.total_runs += 1;
      groups.set(key, existing);
    }
  }
  return groups;
}
