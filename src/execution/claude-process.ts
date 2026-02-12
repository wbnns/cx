import { spawn } from 'node:child_process';
import type { RunResult } from '../types/index.js';

export interface ClaudeSpawnOptions {
  claudePath: string;
  prompt: string;
  model?: string;
  systemPrompt?: string;
  tools?: string[];
  maxBudget?: number;
  sessionId?: string; // for --resume
  env?: Record<string, string>;
  timeoutMs?: number;
  verbose?: boolean;
}

export async function spawnClaude(opts: ClaudeSpawnOptions): Promise<RunResult> {
  const args: string[] = ['-p', '--output-format', 'json'];

  if (opts.model) {
    args.push('--model', opts.model);
  }
  if (opts.systemPrompt) {
    args.push('--system-prompt', opts.systemPrompt);
  }
  if (opts.tools?.length) {
    args.push('--allowedTools', opts.tools.join(','));
  }
  if (opts.maxBudget) {
    args.push('--max-turns-unlimited', '--max-budget-usd', String(opts.maxBudget));
  }
  if (opts.sessionId) {
    args.push('--resume', opts.sessionId);
  }

  args.push('--dangerously-skip-permissions');
  args.push(opts.prompt);

  const startTime = Date.now();

  return new Promise<RunResult>((resolve, reject) => {
    const ac = opts.timeoutMs ? new AbortController() : undefined;
    const timer = opts.timeoutMs
      ? setTimeout(() => ac!.abort(), opts.timeoutMs)
      : undefined;

    const child = spawn(opts.claudePath, args, {
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: ac?.signal,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
      if (opts.verbose) {
        process.stdout.write(data);
      }
    });
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
      if (opts.verbose) {
        process.stderr.write(data);
      }
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      const duration_ms = Date.now() - startTime;

      try {
        const parsed = JSON.parse(stdout);
        resolve({
          session_id: parsed.session_id ?? '',
          result: parsed.result ?? stdout,
          is_error: parsed.is_error ?? (code !== 0),
          total_cost_usd: parsed.cost_usd ?? parsed.total_cost_usd ?? 0,
          usage: parsed.usage ? {
            input_tokens: parsed.usage.input_tokens ?? 0,
            output_tokens: parsed.usage.output_tokens ?? 0,
          } : undefined,
          duration_ms,
        });
      } catch {
        // If JSON parse fails, return raw output
        resolve({
          session_id: '',
          result: stdout || stderr,
          is_error: code !== 0,
          total_cost_usd: 0,
          duration_ms,
        });
      }
    });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
  });
}
