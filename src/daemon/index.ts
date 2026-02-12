import { writeFile, unlink, appendFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { loadConfig, getPidFile, getSocketPath, getDaemonLogFile } from '../core/config.js';
import { startIpcServer, stopIpcServer } from './ipc-server.js';
import { startHeartbeat, stopHeartbeat, getState, updateAgentState } from './heartbeat.js';
import { startFileWatcher, stopFileWatcher } from './file-watcher.js';
import { stopAll } from './process-registry.js';
import { createInitialState, loadDaemonState } from './state.js';
import { compactMemory, shouldCompact } from '../memory/compactor.js';
import { listAgents } from '../core/agent.js';

async function main(): Promise<void> {
  const config = await loadConfig();

  // Set up daemon log file
  const logFile = getDaemonLogFile(config).replace(/^~/, process.env.HOME ?? '');
  const logStream = createWriteStream(logFile, { flags: 'a' });
  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    logStream.write(line);
  };

  log(`cx daemon starting (PID: ${process.pid})`);

  // Write PID file
  await writeFile(getPidFile(), String(process.pid));

  // Recover state or create fresh
  const existingState = await loadDaemonState();
  const state = existingState ?? createInitialState();
  state.pid = process.pid;
  state.started_at = new Date().toISOString();

  // Read tick interval from config
  const tickIntervalMs = (config.daemon?.tick_interval_seconds ?? 30) * 1000;

  // Start IPC server
  await startIpcServer(async (method, params) => {
    switch (method) {
      case 'status':
        return getState();

      case 'start': {
        const name = params?.name as string;
        if (!name) throw new Error('Agent name required');
        updateAgentState(name, { status: 'active', running: false });
        return { message: `Agent ${name} will run on next tick` };
      }

      case 'stop': {
        const name = params?.name as string;
        if (!name) throw new Error('Agent name required');
        updateAgentState(name, { status: 'stopped', running: false });
        return { message: `Agent ${name} stopped` };
      }

      case 'pause': {
        const name = params?.name as string;
        if (!name) throw new Error('Agent name required');
        updateAgentState(name, { status: 'paused' });
        return { message: `Agent ${name} paused` };
      }

      case 'resume': {
        const name = params?.name as string;
        if (!name) throw new Error('Agent name required');
        updateAgentState(name, { status: 'active' });
        return { message: `Agent ${name} resumed` };
      }

      case 'compact': {
        const name = params?.name as string;
        if (params?.all) {
          const agents = await listAgents(config.cx_path);
          for (const agent of agents) {
            if (await shouldCompact(config.cx_path, agent.frontmatter.name)) {
              await compactMemory(config.cx_path, agent.frontmatter.name, config.claude_path);
            }
          }
          return { message: 'Compaction complete for all agents' };
        }
        if (!name) throw new Error('Agent name required');
        await compactMemory(config.cx_path, name, config.claude_path);
        return { message: `Compaction complete for ${name}` };
      }

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  });

  // Start heartbeat with configurable interval
  startHeartbeat(state, tickIntervalMs);

  // Start file watcher
  startFileWatcher(config.cx_path, (event, name, agent) => {
    log(`Agent file ${event}: ${name}`);
    if (event === 'unlink') {
      const currentState = getState();
      delete currentState.agents[name];
    }
  });

  log('cx daemon running');

  // Graceful shutdown
  const shutdown = async () => {
    log('cx daemon shutting down...');
    stopHeartbeat();
    await stopFileWatcher();
    await stopAll();
    await stopIpcServer();
    logStream.end();
    try { await unlink(getPidFile()); } catch {}
    try { await unlink(getSocketPath()); } catch {}
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Daemon failed to start:', err);
  process.exit(1);
});
