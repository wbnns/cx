import { z } from 'zod';

export const agentModeSchema = z.enum(['scheduled', 'watcher', 'persistent']);
export const agentStatusSchema = z.enum(['active', 'paused', 'stopped', 'failed']);
export const notificationEventSchema = z.enum(['completion', 'failure', 'trigger', 'budget_warning']);
export const notificationChannelSchema = z.enum(['telegram']);
export const restartPolicySchema = z.enum(['always', 'on_failure', 'never']);
export const scheduleTypeSchema = z.enum(['cron', 'once', 'manual']);
export const compactionPolicySchema = z.enum(['summarize', 'truncate']);

const scheduleConfigSchema = z.object({
  expression: z.string().min(1),
  type: scheduleTypeSchema.optional(),
  timezone: z.string().optional(),
});

const watcherConfigSchema = z.object({
  script: z.string().min(1),
  poll_interval_seconds: z.number().int().positive().optional(),
  trigger_condition: z.string().optional(),
  cooldown_seconds: z.number().positive().optional(),
  pass_context: z.boolean().optional(),
});

const persistentConfigSchema = z.object({
  heartbeat_interval_seconds: z.number().positive().optional(),
  checkpoint_interval_minutes: z.number().positive().optional(),
  max_session_duration_hours: z.number().positive().optional(),
  restart_policy: restartPolicySchema.optional(),
  restart_delay_seconds: z.number().int().min(0).optional(),
});

const executionConfigSchema = z.object({
  mode: agentModeSchema,
  schedule: scheduleConfigSchema.optional(),
  watcher: watcherConfigSchema.optional(),
  persistent: persistentConfigSchema.optional(),
});

const resourceLimitsSchema = z.object({
  max_cost_usd: z.number().positive().optional(),
  max_tokens: z.number().int().positive().optional(),
  max_duration_seconds: z.number().positive().optional(),
  max_tokens_per_hour: z.number().int().positive().optional(),
  max_cost_per_day_usd: z.number().positive().optional(),
});

const memoryConfigSchema = z.object({
  enabled: z.boolean().optional(),
  compaction_policy: compactionPolicySchema.optional(),
  max_current_tokens: z.number().int().positive().optional(),
  archive_access: z.boolean().optional(),
});

const notificationConfigSchema = z.object({
  channel: notificationChannelSchema,
  events: z.array(notificationEventSchema).optional(),
});

export const agentFrontmatterSchema = z.object({
  name: z.string().min(1),
  type: z.literal('agent').optional(),
  execution: executionConfigSchema,
  status: agentStatusSchema.default('active'),
  categories: z.array(z.string()).optional(),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  resource_limits: resourceLimitsSchema.optional(),
  notifications: z.array(notificationConfigSchema).optional(),
  memory: memoryConfigSchema.optional(),

  // Secrets
  env_ref: z.string().optional(),

  // Stats
  total_runs: z.number().int().min(0).optional(),
  total_cost_usd: z.number().min(0).optional(),
  last_run: z.string().optional(),
  last_status: z.string().optional(),
  session_id: z.string().optional(),
  created: z.string().optional(),
}).refine((data) => {
  if (data.execution.mode === 'scheduled' && !data.execution.schedule) {
    return false;
  }
  return true;
}, { message: 'Scheduled agents must have execution.schedule' }).refine((data) => {
  if (data.execution.mode === 'watcher' && !data.execution.watcher) {
    return false;
  }
  return true;
}, { message: 'Watcher agents must have execution.watcher' });

export type ValidatedAgentFrontmatter = z.infer<typeof agentFrontmatterSchema>;
