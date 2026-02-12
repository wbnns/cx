import { readdir, readFile, chmod, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getSecretsDir } from '../core/config.js';

export async function ensureSecretsDir(): Promise<void> {
  const dir = getSecretsDir();
  await mkdir(dir, { recursive: true });
  await chmod(dir, 0o700);
}

export async function loadSecrets(envRef?: string): Promise<Record<string, string>> {
  const dir = getSecretsDir();
  const env: Record<string, string> = {};

  // Load global secrets
  try {
    const globalEnv = await readFile(join(dir, 'global.env'), 'utf-8');
    Object.assign(env, parseEnvFile(globalEnv));
  } catch {
    // No global secrets
  }

  // Load agent-specific secrets
  if (envRef) {
    try {
      const agentEnv = await readFile(join(dir, `${envRef}.env`), 'utf-8');
      Object.assign(env, parseEnvFile(agentEnv));
    } catch {
      // No agent-specific secrets
    }
  }

  return env;
}

function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}
