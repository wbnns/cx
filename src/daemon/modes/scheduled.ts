import { CronExpressionParser } from 'cron-parser';
import { spawnClaude } from '../../execution/claude-process.js';
import { buildContext } from '../../execution/context-builder.js';
import { appendMemoryEntry } from '../../memory/hot.js';
import { writeRunLog } from '../../storage/run-logger.js';
import { shouldCompact, compactMemory } from '../../memory/compactor.js';
import { dispatch } from '../../notifications/dispatcher.js';
import { loadSecrets } from '../../secrets/loader.js';
import { registerProcess, unregisterProcess, isRunning } from '../process-registry.js';
import { getTools, getScheduleExpression, getScheduleTimezone } from '../../core/frontmatter-accessors.js';
import type { AgentFile, DaemonAgentState, CxConfig, RunResult } from '../../types/index.js';

export function getNextRun(schedule: string, timezone?: string): Date | null {
  try {
    const options: Record<string, unknown> = {};
    if (timezone) options.tz = timezone;
    const interval = CronExpressionParser.parse(schedule, options);
    return interval.next().toDate();
  } catch {
    return null;
  }
}

export function isDue(schedule: string, lastCheck: Date, timezone?: string): boolean {
  try {
    const options: Record<string, unknown> = { currentDate: lastCheck };
    if (timezone) options.tz = timezone;
    const interval = CronExpressionParser.parse(schedule, options);
    const nextAfterLastCheck = interval.next().toDate();
    return nextAfterLastCheck <= new Date();
  } catch {
    return false;
  }
}

export async function executeScheduledRun(
  config: CxConfig,
  agent: AgentFile,
  agentState: DaemonAgentState,
): Promise<RunResult> {
  if (isRunning(agent.frontmatter.name)) {
    throw new Error(`Agent ${agent.frontmatter.name} is already running`);
  }

  const prompt = await buildContext({
    agent,
    cxPath: config.cx_path,
    includeArchives: true,
  });

  const env = await loadSecrets(agent.frontmatter.env_ref);

  const result = await spawnClaude({
    claudePath: config.claude_path,
    prompt,
    model: agent.frontmatter.model ?? config.default_model,
    tools: getTools(agent.frontmatter),
    mcpConfigPath: agent.frontmatter.mcp_config,
    env,
    timeoutMs: 600000, // 10 minute timeout
  });

  // Post-run tasks
  await writeRunLog(config.cx_path, agent.frontmatter, result);

  await appendMemoryEntry(config.cx_path, agent.frontmatter.name, {
    timestamp: new Date().toISOString(),
    type: 'run_result',
    content: `**Status**: ${result.is_error ? 'ERROR' : 'SUCCESS'}\n**Cost**: $${result.total_cost_usd.toFixed(4)}\n\n${result.result.slice(0, 2000)}`,
  });

  // Check compaction
  if (await shouldCompact(config.cx_path, agent.frontmatter.name)) {
    try {
      await compactMemory(config.cx_path, agent.frontmatter.name, config.claude_path);
    } catch {
      // Non-fatal
    }
  }

  // Notifications
  await dispatch(config, agent.frontmatter, {
    event: result.is_error ? 'failure' : 'completion',
    agent: agent.frontmatter,
    message: result.is_error
      ? `Run failed: ${result.result.slice(0, 200)}`
      : `Run completed in ${(result.duration_ms / 1000).toFixed(1)}s ($${result.total_cost_usd.toFixed(4)})\n\n${result.result.slice(0, 3000)}`,
  });

  return result;
}
