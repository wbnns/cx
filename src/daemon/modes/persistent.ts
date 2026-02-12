import { spawnClaude } from '../../execution/claude-process.js';
import { appendMemoryEntry } from '../../memory/hot.js';
import { writeRunLog } from '../../storage/run-logger.js';
import { recordCost } from '../../storage/cost-tracker.js';
import { dispatch } from '../../notifications/dispatcher.js';
import { loadSecrets } from '../../secrets/loader.js';
import { buildContext } from '../../execution/context-builder.js';
import { getMaxBudget, getTools, getRestartPolicy, getMaxSessionDurationHours } from '../../core/frontmatter-accessors.js';
import type { AgentFile, DaemonAgentState, CxConfig, RunResult } from '../../types/index.js';

export async function startPersistentAgent(
  config: CxConfig,
  agent: AgentFile,
  agentState: DaemonAgentState,
): Promise<RunResult> {
  // Initial invocation - build full context
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
    maxBudget: getMaxBudget(agent.frontmatter) ?? 1.0,
    sessionId: agentState.session_id,
    env,
    timeoutMs: 1800000, // 30 min timeout per pulse
  });

  // Store session ID for resume
  agentState.session_id = result.session_id;

  await writeRunLog(config.cx_path, agent.frontmatter, result);
  await recordCost(config.cx_path, agent.frontmatter, result);

  return result;
}

export async function heartbeatPulse(
  config: CxConfig,
  agent: AgentFile,
  agentState: DaemonAgentState,
): Promise<RunResult> {
  if (!agentState.session_id) {
    throw new Error('No session ID for heartbeat - agent needs initial start');
  }

  const env = await loadSecrets(agent.frontmatter.env_ref);

  const result = await spawnClaude({
    claudePath: config.claude_path,
    prompt: 'Continue your ongoing task. Report your current status and any progress.',
    model: agent.frontmatter.model ?? config.default_model,
    sessionId: agentState.session_id,
    maxBudget: 0.05, // Cheap heartbeat
    env,
    timeoutMs: 120000,
  });

  agentState.session_id = result.session_id || agentState.session_id;
  await recordCost(config.cx_path, agent.frontmatter, result);

  return result;
}

export async function checkpointPulse(
  config: CxConfig,
  agent: AgentFile,
  agentState: DaemonAgentState,
): Promise<RunResult> {
  if (!agentState.session_id) {
    throw new Error('No session ID for checkpoint');
  }

  const env = await loadSecrets(agent.frontmatter.env_ref);

  const result = await spawnClaude({
    claudePath: config.claude_path,
    prompt: 'Checkpoint: Summarize your current state, progress, and any pending tasks. This will be saved to memory for continuity.',
    model: agent.frontmatter.model ?? config.default_model,
    sessionId: agentState.session_id,
    maxBudget: 0.10,
    env,
    timeoutMs: 120000,
  });

  agentState.session_id = result.session_id || agentState.session_id;

  // Write checkpoint to memory
  await appendMemoryEntry(config.cx_path, agent.frontmatter.name, {
    timestamp: new Date().toISOString(),
    type: 'checkpoint',
    content: result.result,
  });

  await recordCost(config.cx_path, agent.frontmatter, result);

  return result;
}

export function shouldRestart(
  agent: AgentFile,
  agentState: DaemonAgentState,
  lastResult: RunResult,
): boolean {
  const policy = getRestartPolicy(agent.frontmatter);
  switch (policy) {
    case 'always': return true;
    case 'on_failure': return lastResult.is_error;
    case 'never': return false;
    default: return false;
  }
}

export function isSessionExpired(
  agent: AgentFile,
  agentState: DaemonAgentState,
): boolean {
  const maxHours = getMaxSessionDurationHours(agent.frontmatter);
  if (!maxHours || !agentState.last_run) return false;
  const startTime = new Date(agentState.last_run).getTime();
  const elapsed = (Date.now() - startTime) / (1000 * 60 * 60);
  return elapsed >= maxHours;
}
