# cx — Claude Extender

Autonomous agent management for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Create agents that run on schedules, watch for conditions, or maintain persistent sessions — all defined as markdown files in your **cx directory**.

## What It Does

cx runs a background daemon that manages your agents:

- **Scheduled agents** run on cron schedules (daily surf report, weekly digest, etc.)
- **Watcher agents** run lightweight check scripts and trigger Claude only when conditions are met (new emails, page changes, price alerts)
- **Persistent agents** maintain long-running sessions with heartbeats and checkpoints

Every agent is a markdown file with YAML frontmatter. Instructions go in the body, configuration goes in the frontmatter. Run logs, memory, and costs are all stored as markdown — browsable as plain markdown with full backlinks and search.

## Quick Start

```bash
# Install from source
git clone <repo-url> && cd cx
npm install && npm run build && sudo npm link

# Initialize from your cx directory
cd ~/my-project
cx init

# Configure secrets
cx secrets set global ANTHROPIC_API_KEY sk-ant-...

# Create your first agent
cx create surf-report --mode scheduled
cx edit surf-report    # write instructions

# Start the daemon and trigger a manual run
cx daemon start
cx start surf-report
```

## Agent File Format

Agents are markdown files in `cx/agents/` with YAML frontmatter:

```yaml
---
name: gmail-watcher
type: agent
status: active
execution:
  mode: scheduled
  schedule:
    expression: "0 6 * * *"
    type: cron
    timezone: Atlantic/Azores
tools:
  - mcp__gmail__list_unread
  - mcp__gmail__read_email
  - mcp__gmail__archive
  - mcp__gmail__mark_read
notifications:
  - channel: telegram
    events: [completion, failure]
memory:
  enabled: true
env_ref: email
mcp_config: /home/deploy/nova/cx/tools/gmail-mcp-config.json
---

# Gmail Watcher

Check for new unread emails.
Summarize anything important and archive the rest.
```

The `name` field provides a human-readable identifier. The `mcp_config` field points to a JSON file that tells Claude Code which MCP tool servers to start. Tools prefixed with `mcp__<server>__` correspond to tools exposed by those servers — see [MCP Tools](#mcp-tools) below.

## Three Agent Modes

### Scheduled

Runs on a cron schedule. Good for daily reports, periodic checks, recurring tasks.

```yaml
execution:
  mode: scheduled
  schedule:
    expression: "0 9 * * 1-5"  # weekdays at 9am
    timezone: America/New_York
```

### Watcher

Runs a cheap check script frequently; triggers Claude only when something happens. Good for email monitoring, page changes, price alerts.

```yaml
execution:
  mode: watcher
  watcher:
    script: email-checker.js
    poll_interval_seconds: 300
    cooldown_seconds: 3600
    pass_context: true
```

Watcher scripts are plain JS or Python in `cx/watchers/`:

```javascript
module.exports = async function check(config) {
  const data = await fetchSomething();
  return {
    triggered: data.hasNewItems,
    context: { items: data.items }  // passed to Claude
  };
};
```

### Persistent

Maintains a long-running Claude session with heartbeats and checkpoints. Good for ongoing research, monitoring dashboards, or tasks that build state over time.

```yaml
execution:
  mode: persistent
  persistent:
    heartbeat_interval_seconds: 1800
    checkpoint_interval_minutes: 60
    restart_policy: on_failure
    max_session_duration_hours: 24
```

## MCP Tools

Agents can use custom tools via [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) servers. An MCP server is a small program that exposes tools over stdio — Claude Code starts it automatically and calls its tools during a run.

### Wiring an MCP server to an agent

1. **Write the server** — a Node.js (or Python) script that implements `ListTools` and `CallTool` handlers using `@modelcontextprotocol/sdk`. Place it in `cx/tools/`.

2. **Create a config JSON** pointing to the server:

```json
{
  "mcpServers": {
    "gmail": {
      "command": "node",
      "args": ["/home/deploy/nova/cx/tools/gmail-mcp-server.js"]
    }
  }
}
```

3. **Reference it in the agent's frontmatter** with `mcp_config`:

```yaml
mcp_config: /home/deploy/nova/cx/tools/gmail-mcp-config.json
```

4. **List the tools** in the agent's `tools` array using the `mcp__<server>__<tool>` naming convention:

```yaml
tools:
  - mcp__gmail__list_unread
  - mcp__gmail__read_email
  - mcp__gmail__archive
```

The server name (`gmail`) matches the key in the config JSON. The tool name (`list_unread`) matches what the server's `ListTools` handler returns.

MCP servers and their configs live in `cx/tools/` by convention, with a shared `package.json` for dependencies.

## CLI Commands

| Command | Description |
|---------|-------------|
| `cx init` | Initialize cx in current directory |
| `cx create <name>` | Create a new agent |
| `cx edit <name>` | Open agent file in `$EDITOR` |
| `cx list` | List all agents |
| `cx status` | Quick status overview |
| `cx start <name>` | Manually trigger an agent |
| `cx stop <name>` | Stop a running agent |
| `cx pause <name>` | Pause an agent |
| `cx resume <name>` | Resume a paused agent |
| `cx delete <name>` | Delete an agent (moves to `.trash/`) |
| `cx logs <name>` | View run logs |
| `cx memory <name>` | View agent memory |
| `cx compact <name>` | Trigger memory compaction |
| `cx costs` | View cost breakdown |
| `cx secrets` | Manage secret groups |
| `cx daemon` | Manage background daemon |
| `cx test-watcher <name>` | Test a watcher script |
| `cx install-deps` | Install watcher dependencies |

## Memory System

Each agent has persistent memory in `cx/memory/<agent>/current.md`. After every run, the result is appended. This file is included in the next run's context, so agents remember what they've done.

When memory exceeds a token threshold, cx automatically compacts it — summarizing old entries into an archive and keeping `current.md` focused.

**Persistent Notes** at the top of `current.md` survive compaction. Use them for long-term facts the agent should always know.

## Secrets

Secrets are stored outside the cx directory at `~/.config/cx/secrets/` so they're never synced or committed:

```bash
cx secrets set global API_KEY sk-xxx
cx secrets set email GMAIL_USER you@gmail.com
cx secrets list
```

Reference a secret group in an agent's frontmatter with `env_ref: <group>`. The secrets are injected as environment variables at runtime.

## Cost Management

cx tracks every API call:

```bash
cx costs                      # totals by agent
cx costs --period 2026-02     # filter by month
cx costs --by category        # group by category
```

Set limits in `config.yaml` and per-agent in frontmatter:

```yaml
# config.yaml
cost_limits:
  daily_usd: 25
  monthly_budget_usd: 100

# agent frontmatter
resource_limits:
  max_cost_usd: 0.15          # per run
  max_cost_per_day_usd: 5.00  # persistent agents
```

## Directory Structure

```
my-project/
  cx/
    agents/           # Agent markdown files
    tools/            # MCP servers, bots, and supporting scripts
    watchers/         # Watcher check scripts
    memory/           # Agent memory (current + archives)
    runs/             # Run logs organized by date
    _templates/       # Templates for new agents
    .trash/           # Deleted agents (recoverable)
    costs.md          # Cost ledger
    dashboard.md      # Dashboard
```

## Configuration

Global config lives at `~/.config/cx/config.yaml`:

```yaml
cx_path: ~/my-project
claude_path: claude
default_model: sonnet
default_permission_mode: dangerouslySkipPermissions
timezone: America/Los_Angeles
daemon:
  tick_interval_seconds: 30
  log_file: ~/.config/cx/daemon.log
notifications:
  telegram:
    bot_token: "YOUR_BOT_TOKEN"
    default_chat_id: "YOUR_CHAT_ID"
cost_limits:
  daily_usd: 25
  monthly_budget_usd: 100
compaction:
  default_model: haiku
```

## Requirements

- Node.js 20+
- Claude Code CLI (authenticated)

## Documentation

See the full [User Guide](docs/user-guide.md) for detailed documentation including watcher script examples, memory management, the complete configuration reference, and troubleshooting.

## License

MIT
