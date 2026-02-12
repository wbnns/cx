import type { ChildProcess } from 'node:child_process';

interface RegisteredProcess {
  agentName: string;
  process: ChildProcess;
  startedAt: Date;
}

const registry = new Map<string, RegisteredProcess>();

export function registerProcess(agentName: string, proc: ChildProcess): void {
  registry.set(agentName, {
    agentName,
    process: proc,
    startedAt: new Date(),
  });
}

export function unregisterProcess(agentName: string): void {
  registry.delete(agentName);
}

export function getProcess(agentName: string): ChildProcess | undefined {
  return registry.get(agentName)?.process;
}

export function isRunning(agentName: string): boolean {
  const entry = registry.get(agentName);
  if (!entry) return false;
  return entry.process.exitCode === null && !entry.process.killed;
}

export function listProcesses(): Map<string, RegisteredProcess> {
  return new Map(registry);
}

export async function stopAll(): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const [name, entry] of registry) {
    promises.push(
      new Promise<void>((resolve) => {
        if (entry.process.exitCode !== null || entry.process.killed) {
          resolve();
          return;
        }
        entry.process.on('exit', () => resolve());
        entry.process.kill('SIGTERM');
        // Force kill after 5 seconds
        setTimeout(() => {
          if (entry.process.exitCode === null && !entry.process.killed) {
            entry.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);
      }),
    );
  }
  await Promise.allSettled(promises);
  registry.clear();
}
