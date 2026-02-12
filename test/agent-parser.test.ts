import { describe, it, expect } from 'vitest';
import { parseAgentString, stringifyAgent } from '../src/core/agent-parser.js';
import type { AgentFile } from '../src/types/index.js';

describe('agent-parser', () => {
  const validScheduled = `---
name: test-agent
execution:
  mode: scheduled
  schedule:
    expression: "0 9 * * *"
    type: cron
    timezone: America/Los_Angeles
status: active
total_runs: 0
total_cost_usd: 0
---

# Test Agent

Do something useful.
`;

  it('parses valid scheduled agent', () => {
    const agent = parseAgentString(validScheduled);
    expect(agent.frontmatter.name).toBe('test-agent');
    expect(agent.frontmatter.execution.mode).toBe('scheduled');
    expect(agent.frontmatter.status).toBe('active');
    expect(agent.frontmatter.execution.schedule?.expression).toBe('0 9 * * *');
    expect(agent.body).toContain('# Test Agent');
  });

  it('round-trips agent file', () => {
    const agent = parseAgentString(validScheduled);
    const output = stringifyAgent(agent);
    const reparsed = parseAgentString(output);
    expect(reparsed.frontmatter.name).toBe(agent.frontmatter.name);
    expect(reparsed.frontmatter.execution.mode).toBe(agent.frontmatter.execution.mode);
    expect(reparsed.frontmatter.execution.schedule?.expression).toBe(agent.frontmatter.execution.schedule?.expression);
  });

  it('rejects scheduled agent without schedule', () => {
    const invalid = `---
name: bad-agent
execution:
  mode: scheduled
status: active
---

No schedule defined.
`;
    expect(() => parseAgentString(invalid)).toThrow();
  });

  it('rejects watcher agent without watcher config', () => {
    const invalid = `---
name: bad-watcher
execution:
  mode: watcher
status: active
---

No script.
`;
    expect(() => parseAgentString(invalid)).toThrow();
  });

  it('parses watcher agent', () => {
    const watcher = `---
name: my-watcher
execution:
  mode: watcher
  watcher:
    script: check.js
    poll_interval_seconds: 60
status: active
---

Watch for changes.
`;
    const agent = parseAgentString(watcher);
    expect(agent.frontmatter.execution.mode).toBe('watcher');
    expect(agent.frontmatter.execution.watcher?.script).toBe('check.js');
  });

  it('parses agent with nested resource_limits and memory', () => {
    const full = `---
name: full-agent
type: agent
execution:
  mode: scheduled
  schedule:
    expression: "*/5 * * * *"
    type: cron
status: active
categories:
  - personal
  - monitoring
tools:
  - Read
  - Write
resource_limits:
  max_cost_usd: 1.0
  max_tokens: 50000
memory:
  enabled: true
  max_current_tokens: 8000
notifications:
  - channel: telegram
    events:
      - completion
      - failure
---

Full agent with all options.
`;
    const agent = parseAgentString(full);
    expect(agent.frontmatter.categories).toEqual(['personal', 'monitoring']);
    expect(agent.frontmatter.tools).toEqual(['Read', 'Write']);
    expect(agent.frontmatter.resource_limits?.max_cost_usd).toBe(1.0);
    expect(agent.frontmatter.memory?.max_current_tokens).toBe(8000);
    expect(agent.frontmatter.notifications?.[0]?.channel).toBe('telegram');
  });
});
