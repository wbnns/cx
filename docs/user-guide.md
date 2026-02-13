# cx User Guide & Operations Manual

**cx** (Claude Extender) is a personal agent management system for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). It lets you create autonomous agents that run on schedules, watch for conditions, or maintain persistent sessions — all managed through markdown files in your cx directory.

---

## Table of Contents

1. [Installation & Setup](#1-installation--setup)
2. [Quickstart: Your First Agent](#2-quickstart-your-first-agent)
3. [CLI Reference](#3-cli-reference)
4. [Writing Watcher Scripts](#4-writing-watcher-scripts)
5. [Memory & Compaction](#5-memory--compaction)
6. [Configuration Reference](#6-configuration-reference)
7. [Notifications](#7-notifications)
8. [MCP Tool Servers](#8-mcp-tool-servers)
9. [Telegram Bot](#9-telegram-bot)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Installation & Setup

### 1.1 Prerequisites

- **Node.js 20+** (for cx daemon and watcher scripts)
- **Claude Code CLI** installed and authenticated (`claude` command available)
- **Anthropic API key** with sufficient credits
- **Git** (optional, for version control)

### 1.2 Install cx

```bash
# Install from source
git clone <repo-url> && cd cx
npm install && npm run build && sudo npm link

# Verify installation
cx --version
```

### 1.3 Initialize Your Directory

cx needs to know your cx directory. Run `init` from inside your cx directory:

```bash
cd ~/my-project
cx init
```

This creates the directory structure and a config file at `~/.config/cx/config.yaml`:

```
cx/agents/
cx/watchers/
cx/memory/
cx/runs/
cx/_templates/
cx/.trash/
```

The generated config file:

```yaml
# ~/.config/cx/config.yaml
cx_path: ~/my-project
cx_folder: cx
timezone: America/Los_Angeles
daemon:
  tick_interval_seconds: 30
  log_file: ~/.config/cx/daemon.log
notifications:
  telegram:
    default_chat_id: "YOUR_CHAT_ID"
cost_limits:
  daily_usd: 25
  monthly_budget_usd: 100
  alert_thresholds: [5, 10, 25]
compaction:
  default_model: haiku
```

### 1.4 Configure Secrets

Secrets live outside the cx directory so they're never synced or committed to Git:

```bash
# Global secrets (available to all agents)
cx secrets set global ANTHROPIC_API_KEY sk-ant-...
cx secrets set global TELEGRAM_BOT_TOKEN 123456:ABC...

# Agent-specific secrets
cx secrets set email GMAIL_USER you@gmail.com
cx secrets set email GMAIL_APP_PASSWORD xxxx-xxxx-xxxx

# List configured secret groups
cx secrets list
# global          2 keys
# email           2 keys
```

Secrets are stored in `~/.config/cx/secrets/<group>.env`.

### 1.5 Start the Daemon

```bash
cx daemon start
# cx daemon started (PID 12345)

# Check status
cx daemon status

# View daemon logs
cx daemon logs --follow
```

The daemon must be running for scheduled, watcher, and persistent agents to execute automatically. Manual triggers via `cx start` also require the daemon.

### 1.6 Setting Up MCP Tools

MCP (Model Context Protocol) servers give your agents custom tools — Gmail access, calendar lookups, database queries, or anything else you can code. Here's how to set one up:

**Create the tools directory:**

```bash
mkdir -p cx/tools
cd cx/tools
npm init -y
# Set module type for ESM imports
npm pkg set type=module
npm install @modelcontextprotocol/sdk
```

**Write an MCP server** (e.g., `cx/tools/my-mcp-server.js`):

```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'my-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'my_tool',
      description: 'Does something useful',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'my_tool') {
    const result = await doSomething(request.params.arguments.query);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Create a config JSON** (e.g., `cx/tools/my-mcp-config.json`):

```json
{
  "mcpServers": {
    "myserver": {
      "command": "node",
      "args": ["/absolute/path/to/cx/tools/my-mcp-server.js"]
    }
  }
}
```

**Wire it into your agent's frontmatter:**

```yaml
mcp_config: /absolute/path/to/cx/tools/my-mcp-config.json
tools:
  - mcp__myserver__my_tool
```

The tool naming convention is `mcp__<server>__<tool>` — where `<server>` matches the key in the config JSON and `<tool>` matches the name from `ListTools`.

---

## 2. Quickstart: Your First Agent

Let's create a simple scheduled agent that runs once a day.

### Step 1: Create the agent

```bash
cx create surf-report --mode scheduled
```

This generates a markdown file with default frontmatter. Open it to fill in instructions:

```bash
cx edit surf-report
```

Here's what a complete agent file looks like:

```yaml
---
type: agent
status: active
categories: [health, personal]
execution:
  mode: scheduled
  schedule:
    type: cron
    expression: "30 6 * * *"
    timezone: America/Los_Angeles
tools: [web-search, web-fetch]
notifications:
  - channel: telegram
resource_limits:
  max_tokens: 10000
  max_duration_seconds: 120
  max_cost_usd: 0.15
memory:
  enabled: true
  max_current_tokens: 4000
env_ref: global
---

# Surf Report Agent

Check surf conditions for your local beaches.
Include wave height, period, wind, tides, and a
recommendation. Keep it under 200 words.
```

### Step 2: Test it manually

```bash
cx start surf-report
```

Output:

```
Starting surf-report (scheduled, manual trigger)...
Assembling context: instructions + memory
Spawning Claude Code...

Run completed in 47s
Tokens: 4,200 | Cost: $0.06
Run log: cx/runs/2026-02-12/surf-report-143500.md
Memory updated: cx/memory/surf-report/current.md
```

### Step 3: Verify the output

Check your cx directory. You'll see:

- **`cx/agents/surf-report.md`** — Your agent file with updated `last_run` and `total_runs` frontmatter
- **`cx/runs/2026-02-12/surf-report-143500.md`** — The run log with output, token usage, and timing
- **`cx/memory/surf-report/current.md`** — The agent's memory, now containing its first run result

### Step 4: Let it run on schedule

The daemon handles the rest. Tomorrow at 6:30 AM, cx will automatically run your surf report. Check on things anytime:

```bash
cx status
cx logs surf-report
cx costs
```

### Real-World Example: Gmail Watcher

Here's a production agent that uses MCP tools, notifications, and memory. It checks for new emails every morning, summarizes anything important, and archives the rest.

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
  - mcp__gmail__list_inbox
  - mcp__gmail__read_email
  - mcp__gmail__archive
  - mcp__gmail__mark_read
  - mcp__gmail__flag
  - mcp__gmail__trash
notifications:
  - channel: telegram
    events: [completion, failure]
memory:
  enabled: true
env_ref: email
mcp_config: /home/deploy/nova/cx/tools/gmail-mcp-config.json
---

# Gmail Watcher

You are an email assistant. Every morning:
1. List unread emails
2. Read each one and decide its importance
3. Summarize anything that needs attention
4. Archive newsletters and notifications
5. Flag anything that needs a reply

Report your findings via the run output (sent to Telegram).
```

This agent uses a Gmail MCP server (`cx/tools/gmail-mcp-server.js`) that connects to Gmail via IMAP and exposes tools for listing, reading, archiving, and flagging emails. The `env_ref: email` loads Gmail credentials from the `email` secret group. Notifications go to Telegram on completion or failure.

---

## 3. CLI Reference

### 3.1 `cx list`

List all agents with status and key metadata.

```bash
cx list

# Filter by mode, category, or status
cx list --mode watcher
cx list --category personal
cx list --status paused
```

### 3.2 `cx create`

Create a new agent from a template.

```bash
cx create <name> [--mode scheduled|watcher|persistent]

# Examples
cx create permit-tracker --mode watcher
cx create tax-prep --mode scheduled --category work
cx create research-task --mode persistent
```

The `--mode` flag determines which template and frontmatter fields are generated. Default mode is `scheduled`. Use `--category` to assign comma-separated categories.

### 3.3 `cx edit`

Open an agent's markdown file in your editor.

```bash
cx edit surf-report
```

After saving, the daemon detects the file change and applies new config on the next tick. You can also edit agent files directly with any text editor.

### 3.4 `cx start`

Manually trigger an agent run.

```bash
cx start surf-report

# With verbose output (shows Claude's work in real-time)
cx start surf-report --verbose
```

### 3.5 `cx stop`

Stop a running agent (primarily for persistent agents).

```bash
cx stop trade-monitor
```

### 3.6 `cx pause` / `cx resume`

Temporarily suspend or resume an agent.

```bash
cx pause email-watcher
cx resume email-watcher
```

Paused agents are skipped by the daemon but retain all configuration and memory.

### 3.7 `cx delete`

Delete an agent with options for what to remove.

```bash
cx delete old-experiment
```

You'll see a menu:

```
Delete old-experiment?

  [d] Delete agent file only (move to .trash/)
  [a] Delete agent + all data (memory, logs)
  [c] Cancel
```

Use `-f` to skip confirmation: `cx delete old-experiment -f`

Deleted agent files are moved to `cx/.trash/` so you can restore them later.

### 3.8 `cx logs`

View run logs for an agent.

```bash
cx logs surf-report              # Last 5 runs (summaries)
cx logs surf-report --last 10    # Last 10 runs
cx logs surf-report --last 1 --output   # Full output of last run
cx logs surf-report --follow     # Watch for new logs in real-time
```

### 3.9 `cx memory`

View an agent's current memory or archives.

```bash
cx memory surf-report            # Current memory
cx memory surf-report --archive  # List archive files
```

### 3.10 `cx compact`

Trigger memory compaction.

```bash
cx compact surf-report           # Compact one agent
cx compact surf-report --dry-run # Preview without executing
cx compact surf-report --all     # Compact all agents over threshold
```

### 3.11 `cx status`

Quick overview of all agents and costs.

```bash
cx status
```

Shows agent counts by status and mode, plus any agents in a failed state.

### 3.12 `cx costs`

View cost breakdown.

```bash
cx costs                         # All-time costs by agent
cx costs --period 2026-02        # Filter by month
cx costs --by mode               # Group by mode
cx costs --by category           # Group by category
```

### 3.13 `cx daemon`

Manage the background daemon.

```bash
cx daemon start            # Start daemon (background)
cx daemon stop             # Stop daemon gracefully
cx daemon restart          # Restart daemon
cx daemon status           # Show status
cx daemon logs             # View daemon logs
cx daemon logs --follow    # Follow daemon logs
```

### 3.14 `cx secrets`

Manage secret groups.

```bash
cx secrets set <group> <KEY> <value>
cx secrets get <group> <KEY>
cx secrets list                  # List all groups
cx secrets list <group>          # List keys in a group (values masked)
cx secrets delete <group> <KEY>  # Delete a key
cx secrets delete <group>        # Delete entire group
```

### 3.15 `cx install-deps`

Install dependencies for watcher scripts.

```bash
cx install-deps
```

Scans `cx/watchers/` for `*.package.json` and `*.requirements.txt` files and runs `npm install` or `pip install` for each.

### 3.16 `cx test-watcher`

Test a watcher agent's check script without triggering a Claude run.

```bash
cx test-watcher email-watcher
```

Runs the watcher script, displays the result, evaluates the trigger condition, and shows what would happen.

---

## 4. Writing Watcher Scripts

Watcher scripts are lightweight programs that run frequently **without Claude API calls**. They check a condition and return whether to trigger a full Claude run.

### 4.1 Interface

A watcher script exports a single async `check` function:

```javascript
// watchers/my-watcher.js
module.exports = async function check(config) {
  // config.agent_name  → agent name
  // config.last_check  → ISO timestamp of last check

  // Do your cheap check here...

  return {
    triggered: true,  // or false
    context: {        // data passed to Claude when triggered
      key: "value"
    }
  };
};
```

The `context` object is serialized as JSON and included in the Claude run's input when `pass_context` is `true` in the agent's frontmatter. Put useful data here so the agent doesn't have to re-fetch it.

### 4.2 Example: Email Watcher

```javascript
// watchers/email-watcher.js
const Imap = require("imap");

module.exports = async function check(config) {
  const emails = await getNewEmails(
    config.env.GMAIL_USER,
    config.env.GMAIL_APP_PASSWORD,
    new Date(config.last_check)
  );

  return {
    triggered: emails.length > 0,
    context: {
      new_count: emails.length,
      subjects: emails.map(e => e.subject),
      senders: emails.map(e => e.from),
      preview: emails.slice(0, 10).map(e => ({
        from: e.from,
        subject: e.subject,
        snippet: e.text?.substring(0, 200)
      }))
    }
  };
};
```

### 4.3 Example: Page Change Watcher (Python)

```python
# watchers/permit-tracker.py
import requests, hashlib, json

def check(config):
    url = "https://example.com/permits"
    resp = requests.get(url)
    current_hash = hashlib.md5(resp.text.encode()).hexdigest()

    prev = config.get("prev_hash", "")
    changed = current_hash != prev

    return {
        "triggered": changed,
        "context": {
            "page_content": resp.text[:5000],
            "changed": changed
        }
    }
```

### 4.4 Dependencies

If your watcher needs npm or pip packages, add dependency files alongside it:

```
watchers/
  email-watcher.js
  email-watcher.package.json        ← {"dependencies":{"imap":"^0.8"}}
  permit-tracker.py
  permit-tracker.requirements.txt   ← requests>=2.28
```

Install them all at once:

```bash
cx install-deps
```

### 4.5 Testing Watchers

```bash
cx test-watcher email-watcher
```

This runs the check script, displays the returned `triggered` and `context` values, evaluates the `trigger_condition` expression against the context, and tells you whether a Claude run would have been triggered.

### 4.6 Pairing Watchers with MCP Tools

A common pattern is to pair a lightweight watcher script with a full MCP server. The watcher does a cheap check to decide whether to trigger, while the MCP server provides rich tools for the Claude run itself.

**Example: Gmail**

The gmail-watcher agent uses two scripts:

- **Watcher** (`cx/watchers/gmail-watcher.js`) — A cheap IMAP check that looks for new unseen email UIDs. No Claude API calls. Runs every few minutes via the daemon.
- **MCP server** (`cx/tools/gmail-mcp-server.js`) — Full IMAP client exposing tools like `list_unread`, `read_email`, `archive`, and `mark_read`. Only starts when the watcher triggers a Claude run.

The watcher script tracks seen UIDs in a local cache file so it only triggers when genuinely new emails arrive:

```javascript
// watchers/gmail-watcher.js (simplified)
module.exports.check = async function check() {
  const currentUids = await getUnseenUids();  // cheap IMAP SEARCH
  const trackedUids = loadFromCache();
  const newUids = currentUids.filter(uid => !trackedUids.has(uid));

  if (newUids.length === 0) return { triggered: false };

  saveToCache(currentUids);
  return { triggered: true, context: { count: newUids.length } };
};
```

When triggered, the agent starts the Gmail MCP server (via `mcp_config`) and has full access to read, archive, and flag emails using the `mcp__gmail__*` tools.

This split keeps costs low — the watcher runs without Claude API calls, and the MCP server only spins up when there's actual work to do.

---

## 5. Memory & Compaction

### 5.1 How Memory Works

Each agent has a memory folder at `cx/memory/<agent-name>/`. The `current.md` file is injected into every Claude run as context, giving the agent awareness of what it's done before.

After each run, the agent's output is appended to `current.md`. Over time, this file grows. Compaction summarizes older entries and moves them to archive files, keeping `current.md` focused and costs manageable.

### 5.2 Persistent Notes

The "Persistent Notes" section at the top of `current.md` is special — it **survives compaction**. Use it for long-term facts:

```markdown
## Persistent Notes
- Best bodyboarding spot: Praia do Norte
- User prefers morning sessions before 9am
- NE wind = good conditions at Norte
```

Agents can add to this section via their output. You can also edit it directly to seed an agent with knowledge.

### 5.3 Manual Compaction

```bash
cx compact surf-report             # Compact one agent
cx compact surf-report --all       # All agents over threshold
cx compact surf-report --dry-run   # Preview without executing
```

### 5.4 Viewing Archives

Archives are regular markdown files in `cx/memory/<agent>/archive/`. View them in any text editor or via CLI:

```bash
cx memory surf-report --archive
```

### 5.5 Archive Access at Runtime

Configured per-agent via the `memory.archive_access` field:

- **`on_demand`** — Agent can request an archive mid-run (costs an extra API call)
- **`always_recent`** — Most recent archive always included in context
- **`never`** — Archives are for your reference only; keeps costs minimal

---

## 6. Configuration Reference

All configuration lives in the agent's YAML frontmatter. Here is every field:

### 6.1 Core Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | String | filename | Human-readable identifier for the agent |
| `type` | String | `agent` | Always `"agent"` |
| `status` | Enum | `active` | `active` \| `paused` \| `stopped` \| `failed` |
| `categories` | String[] | `[]` | Tags for organization and cost grouping |
| `tools` | String[] | `[]` | Tools available to the agent (use `mcp__<server>__<tool>` for MCP tools) |
| `model` | String | config default | Model override (e.g., `sonnet`, `opus`, `haiku`) |
| `env_ref` | String | `global` | Secret group name to load |
| `mcp_config` | String | — | Absolute path to MCP server config JSON file |

### 6.2 Execution Fields

| Field | Mode | Description |
|-------|------|-------------|
| `execution.mode` | All | `scheduled` \| `watcher` \| `persistent` |
| `execution.schedule.type` | Scheduled | `cron` \| `once` \| `manual` |
| `execution.schedule.expression` | Scheduled | Cron expression (e.g., `"30 6 * * *"`) |
| `execution.schedule.timezone` | Scheduled | IANA timezone (e.g., `America/Los_Angeles`) |
| `execution.watcher.script` | Watcher | Script path relative to `cx/watchers/` |
| `execution.watcher.poll_interval_seconds` | Watcher | How often to run the check script |
| `execution.watcher.trigger_condition` | Watcher | Expression evaluated against context |
| `execution.watcher.cooldown_seconds` | Watcher | Minimum time between triggers |
| `execution.watcher.pass_context` | Watcher | Include watcher context in Claude run |
| `execution.persistent.heartbeat_interval_seconds` | Persistent | Daemon health check frequency |
| `execution.persistent.checkpoint_interval_minutes` | Persistent | How often agent writes checkpoint to memory |
| `execution.persistent.max_session_duration_hours` | Persistent | Max session length before restart |
| `execution.persistent.restart_policy` | Persistent | `always` \| `on_failure` \| `never` |
| `execution.persistent.restart_delay_seconds` | Persistent | Delay before restarting |

### 6.3 Resource Limits

| Field | Description |
|-------|-------------|
| `resource_limits.max_tokens` | Max tokens per run |
| `resource_limits.max_duration_seconds` | Max wall-clock time per run |
| `resource_limits.max_cost_usd` | Max cost per run |
| `resource_limits.max_tokens_per_hour` | Hourly token budget (persistent) |
| `resource_limits.max_cost_per_day_usd` | Daily cost ceiling (persistent) |

### 6.4 Memory Fields

| Field | Description |
|-------|-------------|
| `memory.enabled` | Enable/disable memory for this agent |
| `memory.compaction_policy` | `summarize` \| `truncate` |
| `memory.max_current_tokens` | Compaction trigger threshold for `current.md` |
| `memory.archive_access` | `on_demand` \| `always_recent` \| `never` |

### 6.5 Notifications

```yaml
notifications:
  - channel: telegram
    events: [completion, failure, trigger, budget_warning]
```

### 6.6 MCP Config File Format

The `mcp_config` frontmatter field points to a JSON file that defines which MCP servers to start for a run:

```json
{
  "mcpServers": {
    "server_name": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server.js"]
    }
  }
}
```

Multiple servers can be defined in one config file. Each server key becomes the middle segment of the `mcp__<server>__<tool>` naming convention.

### 6.7 Global Config (`~/.config/cx/config.yaml`)

| Field | Type | Description |
|-------|------|-------------|
| `cx_path` | String | Path to the project containing the `cx/` directory |
| `claude_path` | String | Path to the Claude Code CLI binary (default: `claude`) |
| `default_model` | String | Default model for agent runs (e.g., `sonnet`, `opus`) |
| `default_permission_mode` | String | Claude Code permission mode for agent runs (e.g., `dangerouslySkipPermissions` for autonomous agents) |
| `cx_folder` | String | Name of the cx subdirectory (default: `cx`) |
| `timezone` | String | Default IANA timezone |
| `daemon.tick_interval_seconds` | Number | How often the daemon checks for work |
| `daemon.log_file` | String | Path to daemon log file |
| `notifications.telegram.bot_token` | String | Telegram bot API token |
| `notifications.telegram.default_chat_id` | String | Default Telegram chat ID for notifications |
| `cost_limits.daily_usd` | Number | Daily cost ceiling across all agents |
| `cost_limits.monthly_budget_usd` | Number | Monthly cost budget |
| `compaction.default_model` | String | Model used for memory compaction (default: `haiku`) |

---

## 7. Notifications

cx sends notifications via Telegram when agent events occur. Configure notifications per-agent in frontmatter:

```yaml
notifications:
  - channel: telegram
    events: [completion, failure]
```

Available events: `completion`, `failure`, `trigger`, `budget_warning`.

Global Telegram credentials are configured in `~/.config/cx/config.yaml`:

```yaml
notifications:
  telegram:
    bot_token: "YOUR_BOT_TOKEN"
    default_chat_id: "YOUR_CHAT_ID"
```

---

## 8. MCP Tool Servers

MCP (Model Context Protocol) servers are Node.js (or Python) programs that expose custom tools to Claude Code agents. They communicate over stdio — Claude Code starts the server, calls tools during a run, and shuts it down when finished.

### 8.1 Directory Convention

```
cx/tools/
  gmail-mcp-server.js          # MCP server implementation
  gmail-mcp-config.json         # Config JSON for the server
  calendar-mcp-server.js
  calendar-mcp-config.json
  telegram-bot.js               # Other supporting scripts
  transcribe.py
  package.json                  # Shared dependencies
```

### 8.2 Dependencies

The `cx/tools/package.json` manages shared dependencies for all MCP servers:

```json
{
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0",
    "imap": "^0.8",
    "mailparser": "^3.7",
    "node-ical": "^0.25.1"
  }
}
```

Install with `npm install` from the `cx/tools/` directory.

### 8.3 Anatomy of an MCP Server

Every MCP server implements two handlers:

1. **`ListTools`** — Returns an array of tool definitions (name, description, input schema)
2. **`CallTool`** — Executes a tool by name and returns the result

```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'my-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'my_tool',
      description: 'Does something useful',
      inputSchema: {
        type: 'object',
        properties: {
          param: { type: 'string', description: 'Input parameter' },
        },
        required: ['param'],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === 'my_tool') {
    const result = await doWork(args.param);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 8.4 Config JSON Format

Each MCP server needs a config JSON that tells Claude Code how to start it:

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

The server key (`gmail`) becomes the middle segment in the tool naming convention: `mcp__gmail__list_unread`.

### 8.5 Wiring into an Agent

Add two fields to the agent's frontmatter:

```yaml
mcp_config: /home/deploy/nova/cx/tools/gmail-mcp-config.json
tools:
  - mcp__gmail__list_unread
  - mcp__gmail__read_email
  - mcp__gmail__archive
  - mcp__gmail__mark_read
```

The agent can only call tools listed in its `tools` array — this acts as an allowlist even if the MCP server exposes more tools.

### 8.6 Example: Gmail MCP Server

A production Gmail MCP server that connects via IMAP and exposes email management tools:

```javascript
// cx/tools/gmail-mcp-server.js (abbreviated)
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

const server = new Server(
  { name: 'gmail', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'list_unread', description: 'List unread emails', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
    { name: 'read_email', description: 'Read a specific email by UID', inputSchema: { type: 'object', properties: { uid: { type: 'string' } }, required: ['uid'] } },
    { name: 'archive', description: 'Archive an email by UID', inputSchema: { type: 'object', properties: { uid: { type: 'string' } }, required: ['uid'] } },
    { name: 'mark_read', description: 'Mark an email as read', inputSchema: { type: 'object', properties: { uid: { type: 'string' } }, required: ['uid'] } },
    // ... more tools
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case 'list_unread': return await listUnread(args.limit);
    case 'read_email':  return await readEmail(args.uid);
    case 'archive':     return await archiveEmail(args.uid);
    case 'mark_read':   return await markRead(args.uid);
    default: throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

Environment variables (`GMAIL_USER`, `GMAIL_APP_PASSWORD`) are injected via the agent's `env_ref: email` secret group.

### 8.7 Example: Calendar MCP Server

A simpler single-tool server that fetches today's calendar events from ICS URLs:

```javascript
// cx/tools/calendar-mcp-server.js (abbreviated)
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import ical from 'node-ical';

const server = new Server(
  { name: 'calendar', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_today',
      description: "List today's calendar events",
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'list_today') {
    const events = await fetchTodaysEvents();  // Fetches from GOOGLE_CALENDAR_ICS_URLS env var
    return { content: [{ type: 'text', text: JSON.stringify(events) }] };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

Agent frontmatter:

```yaml
mcp_config: /home/deploy/nova/cx/tools/calendar-mcp-config.json
tools:
  - mcp__calendar__list_today
```

---

## 9. Telegram Bot

cx includes a Telegram bot (`cx/tools/telegram-bot.js`) that lets you control your agents via natural language messages from your phone.

### 9.1 What It Does

The bot uses long-polling to receive messages and interprets them via Claude Haiku. You can send natural language like "check my emails" or "what's the gmail watcher status?" and the bot translates that into cx commands.

**Capabilities:**

- **Status & listing** — "status", "list agents", "what's running?"
- **Logs** — "show gmail-watcher logs", "last run output"
- **Memory** — "what does gmail-watcher remember?"
- **Control** — "start gmail-watcher", "pause calendar-checker", "resume all"
- **Persistent notes** — "remember that I'm on vacation until Friday"
- **Voice messages** — Transcribes voice notes and processes them as commands
- **Research mode** — "research best practices for X" (triggers a longer Claude run)

### 9.2 Setup

The bot reads its configuration from `~/.config/cx/config.yaml`:

```yaml
notifications:
  telegram:
    bot_token: "YOUR_BOT_TOKEN"
    default_chat_id: "YOUR_CHAT_ID"
```

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Copy the bot token to `config.yaml`
3. Send a message to your bot, then use the Telegram API to find your chat ID
4. Set `default_chat_id` in `config.yaml`

### 9.3 Running the Bot

```bash
# Direct
node cx/tools/telegram-bot.js

# Via pm2 (recommended for production)
pm2 start cx/tools/telegram-bot.js --name cx-telegram-bot

# Via systemd
# Create a service file pointing to the script
```

The bot runs as a separate long-lived process alongside the cx daemon.

---

## 10. Troubleshooting

### Agent isn't running on schedule

1. Is the daemon running? `cx daemon status`
2. Is the agent status `active`? Check frontmatter.
3. Is the cron expression correct? Use [crontab.guru](https://crontab.guru) to verify.
4. Check timezone — is it set to the right IANA timezone?
5. Check daemon logs: `cx daemon logs --follow`

### Watcher not triggering

1. Test the watcher script: `cx test-watcher <name>`
2. Check `trigger_condition` matches the context keys your script returns.
3. Is the watcher in cooldown? Check `cooldown_seconds` and last trigger time.
4. Are dependencies installed? `cx install-deps`

### Persistent session keeps dying

1. Check resource limits — is `max_tokens_per_hour` too low?
2. Check daemon logs for heartbeat failures.
3. Increase `heartbeat_interval_seconds` if the agent does heavy work between checks.
4. Check `max_session_duration_hours` — is it expiring normally?

### Memory file getting too large

1. Run `cx compact <name>` to force compaction.
2. Lower `max_current_tokens` to trigger compaction earlier.
3. Review agent instructions — is it writing too much to memory?

### High costs

1. Run `cx costs --period 2026-02 --by agent` to identify expensive agents.
2. Consider moving scheduled agents to watcher mode if many runs find nothing actionable.
3. Lower `resource_limits.max_cost_usd` per run.
4. Use `compaction.default_model: haiku` in config for cheaper compaction.
5. Check persistent agents — are they necessary, or would a watcher suffice?

### Secrets not loading

1. Verify the secret group exists: `cx secrets list`
2. Check that `env_ref` in the agent frontmatter matches the group name.
3. Verify the specific key: `cx secrets get <group> <KEY>`
