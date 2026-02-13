import { createHash } from 'node:crypto';
import { fork } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { Parser } from 'expr-eval';
import { spawnClaude } from '../../execution/claude-process.js';
import { buildContext } from '../../execution/context-builder.js';
import { appendMemoryEntry } from '../../memory/hot.js';
import { writeRunLog } from '../../storage/run-logger.js';
import { dispatch } from '../../notifications/dispatcher.js';
import { loadSecrets } from '../../secrets/loader.js';
import { getWatchersDir } from '../../core/paths.js';
import { getWatchScript, getTools } from '../../core/frontmatter-accessors.js';
import type { AgentFile, DaemonAgentState, CxConfig } from '../../types/index.js';

const MAX_CONSECUTIVE_FAILURES = 3;
const SCRIPT_TIMEOUT_MS = 30000;

export interface WatcherResult {
  triggered: boolean;
  context?: Record<string, unknown>;
  error?: string;
}

export async function runWatcherCheck(
  cxPath: string,
  agent: AgentFile,
): Promise<WatcherResult> {
  const scriptName = getWatchScript(agent.frontmatter);
  if (!scriptName) throw new Error('No watcher script configured');

  const scriptPath = join(getWatchersDir(cxPath), scriptName);
  // Resolve from process.argv[1] (the daemon entry point at dist/daemon/index.js)
  // so this works regardless of whether tsup chunks this code or inlines it.
  const distRoot = dirname(dirname(realpathSync(process.argv[1])));
  const harnessPath = join(distRoot, 'daemon', 'watcher-harness.js');

  const secrets = await loadSecrets(agent.frontmatter.env_ref);

  return new Promise<WatcherResult>((resolve) => {
    const child = fork(harnessPath, [scriptPath], {
      timeout: SCRIPT_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        ...secrets,
        CX_WATCHER_CONFIG: JSON.stringify({
          agent_name: agent.frontmatter.name,
          last_check: new Date().toISOString(),
        }),
      },
    });

    let stdout = '';
    child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });

    child.on('message', (msg: unknown) => {
      resolve(msg as WatcherResult);
    });

    child.on('exit', (code) => {
      if (code !== 0) {
        resolve({ triggered: false, error: `Script exited with code ${code}: ${stdout}` });
      }
    });

    child.on('error', (err) => {
      resolve({ triggered: false, error: err.message });
    });

    setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ triggered: false, error: 'Script timed out' });
    }, SCRIPT_TIMEOUT_MS);
  });
}

export function evaluateTriggerCondition(
  condition: string,
  context: Record<string, unknown>,
): boolean {
  if (!condition) return true; // No condition = always trigger
  try {
    const parser = new Parser();
    const expr = parser.parse(condition);
    const result = expr.evaluate(context as Record<string, number>);
    return Boolean(result);
  } catch {
    return false;
  }
}

export function isInCooldown(agentState: DaemonAgentState): boolean {
  if (!agentState.cooldown_until) return false;
  return new Date(agentState.cooldown_until) > new Date();
}

export async function executeWatcherRun(
  config: CxConfig,
  agent: AgentFile,
  agentState: DaemonAgentState,
  watcherContext?: string,
): Promise<void> {
  const prompt = await buildContext({
    agent,
    cxPath: config.cx_path,
    watcherContext,
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
    timeoutMs: 600000,
  });

  await writeRunLog(config.cx_path, agent.frontmatter, result);

  await appendMemoryEntry(config.cx_path, agent.frontmatter.name, {
    timestamp: new Date().toISOString(),
    type: 'run_result',
    content: `**Triggered by watcher**\n**Status**: ${result.is_error ? 'ERROR' : 'SUCCESS'}\n**Cost**: $${result.total_cost_usd.toFixed(4)}\n\n${result.result.slice(0, 2000)}`,
  });

  // Deduplicate notifications: skip dispatch if result is identical to previous run
  const resultHash = createHash('sha256').update(result.result).digest('hex');
  const isDuplicate = agentState._lastResultHash === resultHash;
  agentState._lastResultHash = resultHash;

  if (isDuplicate && !result.is_error) {
    return; // Skip duplicate notification
  }

  await dispatch(config, agent.frontmatter, {
    event: result.is_error ? 'failure' : 'completion',
    agent: agent.frontmatter,
    message: result.is_error
      ? `Watcher run failed: ${result.result.slice(0, 200)}`
      : `Watcher run completed ($${result.total_cost_usd.toFixed(4)})\n\n${result.result.slice(0, 3000)}`,
  });
}
