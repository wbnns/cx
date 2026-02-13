import type { AgentFrontmatter, AgentMode } from '../types/index.js';

export function getMode(fm: AgentFrontmatter): AgentMode {
  return fm.execution.mode;
}

export function getScheduleExpression(fm: AgentFrontmatter): string | undefined {
  return fm.execution.schedule?.expression;
}

export function getScheduleTimezone(fm: AgentFrontmatter): string | undefined {
  return fm.execution.schedule?.timezone;
}

export function getWatchScript(fm: AgentFrontmatter): string | undefined {
  return fm.execution.watcher?.script;
}

export function getPollIntervalSeconds(fm: AgentFrontmatter): number {
  return fm.execution.watcher?.poll_interval_seconds ?? 300;
}

export function getTriggerCondition(fm: AgentFrontmatter): string | undefined {
  return fm.execution.watcher?.trigger_condition;
}

export function getCooldownSeconds(fm: AgentFrontmatter): number | undefined {
  return fm.execution.watcher?.cooldown_seconds;
}

export function getPassContext(fm: AgentFrontmatter): boolean {
  return fm.execution.watcher?.pass_context ?? false;
}

export function getHeartbeatSeconds(fm: AgentFrontmatter): number {
  return fm.execution.persistent?.heartbeat_interval_seconds ?? 1800;
}

export function getCheckpointMinutes(fm: AgentFrontmatter): number {
  return fm.execution.persistent?.checkpoint_interval_minutes ?? 60;
}

export function getMaxSessionDurationHours(fm: AgentFrontmatter): number | undefined {
  return fm.execution.persistent?.max_session_duration_hours;
}

export function getRestartPolicy(fm: AgentFrontmatter): string {
  return fm.execution.persistent?.restart_policy ?? 'never';
}

export function getRestartDelaySeconds(fm: AgentFrontmatter): number {
  return fm.execution.persistent?.restart_delay_seconds ?? 30;
}

export function getTools(fm: AgentFrontmatter): string[] | undefined {
  return fm.tools;
}

export function getNotifyChannels(fm: AgentFrontmatter): string[] {
  return fm.notifications?.map(n => n.channel) ?? [];
}

export function getNotifyEvents(fm: AgentFrontmatter): string[] {
  const allEvents: string[] = [];
  for (const n of fm.notifications ?? []) {
    if (n.events) allEvents.push(...n.events);
  }
  return allEvents;
}

export function getMaxCurrentTokens(fm: AgentFrontmatter): number {
  return fm.memory?.max_current_tokens ?? 4000;
}
