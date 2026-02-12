// This file runs as a child process. It loads and executes a watcher script.
const scriptPath: string = process.argv[2] ?? '';
if (!scriptPath) {
  console.error('No script path provided');
  process.exit(1);
}

async function run() {
  try {
    // Parse CX_WATCHER_CONFIG if available
    let watcherConfig: Record<string, unknown> = {};
    if (process.env.CX_WATCHER_CONFIG) {
      try {
        watcherConfig = JSON.parse(process.env.CX_WATCHER_CONFIG);
      } catch {}
    }

    // Support both .js and .py scripts
    if (scriptPath.endsWith('.py')) {
      const { execFileSync } = await import('node:child_process');
      const output = execFileSync('python3', [scriptPath], {
        timeout: 25000,
        encoding: 'utf-8',
        env: { ...process.env },
      });
      const result = JSON.parse(output);
      process.send?.(result);
    } else {
      // JS script
      const mod = await import(scriptPath);
      const check = mod.default?.check ?? mod.check;
      if (typeof check !== 'function') {
        process.send?.({ triggered: false, error: 'Script has no check() function' });
        process.exit(1);
      }
      const result = await check(watcherConfig);
      process.send?.(result ?? { triggered: false });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.send?.({ triggered: false, error: message });
    process.exit(1);
  }
}

run();
