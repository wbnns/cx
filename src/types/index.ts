export type AgentMode = 'scheduled' | 'watcher' | 'persistent';
export type AgentStatus = 'active' | 'paused' | 'stopped' | 'failed';
export type NotificationChannel = 'telegram';
export type NotificationEvent = 'completion' | 'failure' | 'trigger' | 'budget_warning';
export type RestartPolicy = 'always' | 'on_failure' | 'never';
export type ScheduleType = 'cron' | 'once' | 'manual';
export type CompactionPolicy = 'summarize' | 'truncate';

export interface ScheduleConfig {
  expression: string; // cron expression
  type?: ScheduleType;
  timezone?: string;
}

export interface WatcherConfig {
  script: string;
  poll_interval_seconds?: number;
  trigger_condition?: string;
  cooldown_seconds?: number;
  pass_context?: boolean;
}

export interface PersistentConfig {
  heartbeat_interval_seconds?: number;
  checkpoint_interval_minutes?: number;
  max_session_duration_hours?: number;
  restart_policy?: RestartPolicy;
  restart_delay_seconds?: number;
}

export interface ExecutionConfig {
  mode: AgentMode;
  schedule?: ScheduleConfig;
  watcher?: WatcherConfig;
  persistent?: PersistentConfig;
}

export interface ResourceLimits {
  max_cost_usd?: number;
  max_tokens?: number;
  max_duration_seconds?: number;
  max_tokens_per_hour?: number;
  max_cost_per_day_usd?: number;
}

export interface MemoryConfig {
  enabled?: boolean;
  compaction_policy?: CompactionPolicy;
  max_current_tokens?: number;
  archive_access?: boolean;
}

export interface NotificationConfig {
  channel: NotificationChannel;
  events?: NotificationEvent[];
}

export interface AgentFrontmatter {
  name: string;
  type?: 'agent';
  execution: ExecutionConfig;
  status: AgentStatus;
  categories?: string[];
  model?: string;
  tools?: string[];
  resource_limits?: ResourceLimits;
  notifications?: NotificationConfig[];
  memory?: MemoryConfig;

  // Secrets
  env_ref?: string;

  // Stats (auto-updated)
  total_runs?: number;
  total_cost_usd?: number;
  last_run?: string; // ISO date
  last_status?: string;
  session_id?: string;
  created?: string; // ISO date
}

export interface AgentFile {
  frontmatter: AgentFrontmatter;
  body: string; // The markdown body (system prompt / instructions)
}

export interface RunResult {
  session_id: string;
  result: string;
  is_error: boolean;
  total_cost_usd: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  duration_ms: number;
}

export interface DaemonState {
  pid: number;
  started_at: string;
  agents: Record<string, DaemonAgentState>;
}

export interface DaemonAgentState {
  name: string;
  mode: AgentMode;
  status: AgentStatus;
  running: boolean;
  pid?: number;
  session_id?: string;
  last_run?: string;
  last_check?: string;
  next_run?: string;
  consecutive_failures?: number;
  cooldown_until?: string;
}

export interface IpcRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface IpcResponse {
  id: string;
  result?: unknown;
  error?: string;
}

export interface CxConfig {
  cx_path: string;
  claude_path: string;
  default_model: string;
  default_permission_mode: string;
  cx_folder?: string;
  timezone?: string;
  daemon?: {
    tick_interval_seconds?: number;
    log_file?: string;
    pid_file?: string;
  };
  notifications?: {
    telegram?: {
      bot_token: string;
      default_chat_id: string;
    };
  };
  cost_limits?: {
    warn_threshold_usd?: number;
    monthly_budget_usd?: number;
    daily_usd?: number;
    alert_thresholds?: number[];
  };
  compaction?: {
    default_model?: string;
  };
}

export interface MemoryEntry {
  timestamp: string;
  type: 'run_result' | 'checkpoint' | 'note' | 'compaction';
  content: string;
}

export interface MemoryFile {
  agent_name: string;
  token_count: number;
  last_compacted?: string;
  persistent_notes: string;
  entries: MemoryEntry[];
}

export interface CostRecord {
  date: string;
  agent: string;
  mode: AgentMode;
  categories?: string[];
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
}
