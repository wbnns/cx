import { loadConfig } from '../core/config.js';
import { listAgents } from '../core/agent.js';
import { updateAgentFrontmatter } from '../core/agent-parser.js';
import { getAgentFile } from '../core/paths.js';
import { saveDaemonState } from './state.js';
import { isRunning } from './process-registry.js';
import { isDue, getNextRun, executeScheduledRun } from './modes/scheduled.js';
import { runWatcherCheck, evaluateTriggerCondition, isInCooldown, executeWatcherRun } from './modes/watcher.js';
import { heartbeatPulse, checkpointPulse, startPersistentAgent, shouldRestart, isSessionExpired } from './modes/persistent.js';
import { dispatch } from '../notifications/dispatcher.js';
import {
  getScheduleExpression, getScheduleTimezone,
  getPollIntervalSeconds, getCooldownSeconds, getPassContext,
  getTriggerCondition, getHeartbeatSeconds, getCheckpointMinutes,
  getMaxSessionDurationHours,
} from '../core/frontmatter-accessors.js';
import type { DaemonState, DaemonAgentState, AgentFile, CxConfig } from '../types/index.js';

const DEFAULT_TICK_INTERVAL_MS = 30000; // 30 seconds

let tickTimer: ReturnType<typeof setInterval> | null = null;
let state: DaemonState;

export function startHeartbeat(initialState: DaemonState, tickIntervalMs?: number): void {
  state = initialState;
  const interval = tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS;
  tickTimer = setInterval(() => tick().catch(console.error), interval);
  // Run first tick immediately
  tick().catch(console.error);
}

export function stopHeartbeat(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

export function getState(): DaemonState {
  return state;
}

export function updateAgentState(name: string, updates: Partial<DaemonAgentState>): void {
  const existing = state.agents[name];
  if (existing) {
    Object.assign(existing, updates);
  }
}

async function tick(): Promise<void> {
  let config: CxConfig;
  try {
    config = await loadConfig();
  } catch {
    return; // Config missing, skip tick
  }

  // Refresh agent list
  const agents = await listAgents(config.cx_path);

  // Update state with current agents
  for (const agent of agents) {
    const name = agent.frontmatter.name;
    if (!state.agents[name]) {
      state.agents[name] = {
        name,
        mode: agent.frontmatter.execution.mode,
        status: agent.frontmatter.status,
        running: false,
      };
    } else {
      state.agents[name]!.mode = agent.frontmatter.execution.mode;
      state.agents[name]!.status = agent.frontmatter.status;
    }
  }

  // Process each agent
  for (const agent of agents) {
    const name = agent.frontmatter.name;
    const agentState = state.agents[name]!;

    // Skip paused or stopped agents
    if (agentState.status === 'paused' || agentState.status === 'stopped') continue;
    // Skip if already running
    if (agentState.running || isRunning(name)) continue;

    try {
      switch (agent.frontmatter.execution.mode) {
        case 'scheduled':
          await handleScheduled(config, agent, agentState);
          break;
        case 'watcher':
          await handleWatcher(config, agent, agentState);
          break;
        case 'persistent':
          await handlePersistent(config, agent, agentState);
          break;
      }
    } catch (err) {
      console.error(`Error processing agent ${name}:`, err);
      agentState.consecutive_failures = (agentState.consecutive_failures ?? 0) + 1;
    }
  }

  // Persist state
  await saveDaemonState(state);
}

async function handleScheduled(config: CxConfig, agent: AgentFile, agentState: DaemonAgentState): Promise<void> {
  const schedule = getScheduleExpression(agent.frontmatter);
  if (!schedule) return;

  const timezone = getScheduleTimezone(agent.frontmatter);
  const lastCheck = agentState.last_check ? new Date(agentState.last_check) : new Date(0);
  agentState.last_check = new Date().toISOString();

  if (!isDue(schedule, lastCheck, timezone)) {
    agentState.next_run = getNextRun(schedule, timezone)?.toISOString();
    return;
  }

  agentState.running = true;
  try {
    await executeScheduledRun(config, agent, agentState);
    agentState.last_run = new Date().toISOString();
    agentState.consecutive_failures = 0;
    agentState.next_run = getNextRun(schedule, timezone)?.toISOString();
  } catch (err) {
    agentState.consecutive_failures = (agentState.consecutive_failures ?? 0) + 1;
    console.error(`Scheduled run failed for ${agent.frontmatter.name}:`, err);
  } finally {
    agentState.running = false;
  }
}

async function handleWatcher(config: CxConfig, agent: AgentFile, agentState: DaemonAgentState): Promise<void> {
  // Check interval (seconds → ms)
  const checkIntervalMs = getPollIntervalSeconds(agent.frontmatter) * 1000;
  const lastCheck = agentState.last_check ? new Date(agentState.last_check).getTime() : 0;
  if (Date.now() - lastCheck < checkIntervalMs) return;

  agentState.last_check = new Date().toISOString();

  // Cooldown check
  if (isInCooldown(agentState)) return;

  // Run watcher check
  const watchResult = await runWatcherCheck(config.cx_path, agent);

  if (watchResult.error) {
    agentState.consecutive_failures = (agentState.consecutive_failures ?? 0) + 1;
    if (agentState.consecutive_failures >= 3) {
      // Auto-pause after 3 consecutive failures
      await updateAgentFrontmatter(getAgentFile(config.cx_path, agent.frontmatter.name), { status: 'paused' });
      agentState.status = 'paused';
      await dispatch(config, agent.frontmatter, {
        event: 'failure',
        agent: agent.frontmatter,
        message: `Auto-paused after ${agentState.consecutive_failures} consecutive watcher failures: ${watchResult.error}`,
      });
    }
    return;
  }

  // Evaluate trigger condition
  let triggered = watchResult.triggered;
  const triggerCondition = getTriggerCondition(agent.frontmatter);
  if (triggered && triggerCondition && watchResult.context) {
    triggered = evaluateTriggerCondition(triggerCondition, watchResult.context);
  }

  if (!triggered) return;

  // Set cooldown (seconds → ms)
  const cooldownSec = getCooldownSeconds(agent.frontmatter);
  if (cooldownSec) {
    const cooldownUntil = new Date(Date.now() + cooldownSec * 1000);
    agentState.cooldown_until = cooldownUntil.toISOString();
  }

  // Dispatch trigger notification
  await dispatch(config, agent.frontmatter, {
    event: 'trigger',
    agent: agent.frontmatter,
    message: `Watcher triggered: ${JSON.stringify(watchResult.context ?? {}).slice(0, 200)}`,
  });

  // Execute watcher run
  agentState.running = true;
  try {
    const passContext = getPassContext(agent.frontmatter);
    const contextStr = passContext && watchResult.context
      ? JSON.stringify(watchResult.context, null, 2)
      : undefined;
    await executeWatcherRun(config, agent, agentState, contextStr);
    agentState.last_run = new Date().toISOString();
    agentState.consecutive_failures = 0;
  } catch (err) {
    agentState.consecutive_failures = (agentState.consecutive_failures ?? 0) + 1;
    console.error(`Watcher run failed for ${agent.frontmatter.name}:`, err);
  } finally {
    agentState.running = false;
  }
}

async function handlePersistent(config: CxConfig, agent: AgentFile, agentState: DaemonAgentState): Promise<void> {
  // Check session expiration
  if (isSessionExpired(agent, agentState)) {
    agentState.session_id = undefined;
    agentState.status = 'stopped';
    await updateAgentFrontmatter(getAgentFile(config.cx_path, agent.frontmatter.name), { status: 'stopped' });
    return;
  }

  const now = Date.now();

  if (!agentState.session_id) {
    // Initial start
    agentState.running = true;
    try {
      await startPersistentAgent(config, agent, agentState);
      agentState.last_run = new Date().toISOString();
      agentState.consecutive_failures = 0;
    } catch (err) {
      agentState.consecutive_failures = (agentState.consecutive_failures ?? 0) + 1;
      console.error(`Persistent start failed for ${agent.frontmatter.name}:`, err);
    } finally {
      agentState.running = false;
    }
    return;
  }

  // Heartbeat check (seconds → ms)
  const heartbeatIntervalMs = getHeartbeatSeconds(agent.frontmatter) * 1000;
  const lastRun = agentState.last_run ? new Date(agentState.last_run).getTime() : 0;

  if (now - lastRun >= heartbeatIntervalMs) {
    agentState.running = true;
    try {
      // Check if checkpoint is also due
      const checkpointIntervalMs = getCheckpointMinutes(agent.frontmatter) * 60000;
      const lastCheckpoint = agentState.last_check ? new Date(agentState.last_check).getTime() : 0;

      if (now - lastCheckpoint >= checkpointIntervalMs) {
        await checkpointPulse(config, agent, agentState);
        agentState.last_check = new Date().toISOString();
      } else {
        await heartbeatPulse(config, agent, agentState);
      }
      agentState.last_run = new Date().toISOString();
      agentState.consecutive_failures = 0;
    } catch (err) {
      agentState.consecutive_failures = (agentState.consecutive_failures ?? 0) + 1;
      console.error(`Persistent heartbeat failed for ${agent.frontmatter.name}:`, err);
    } finally {
      agentState.running = false;
    }
  }
}
