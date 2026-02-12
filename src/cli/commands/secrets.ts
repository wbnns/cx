import { Command } from 'commander';
import { readFile, writeFile, readdir, unlink, mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { getSecretsDir } from '../../core/config.js';

export const secretsCommand = new Command('secrets')
  .description('Manage secret groups');

secretsCommand
  .command('set')
  .description('Set a secret in a group')
  .argument('<group>', 'Secret group name (e.g., global, surf-report)')
  .argument('<key>', 'Secret key')
  .argument('<value>', 'Secret value')
  .action(async (group: string, key: string, value: string) => {
    const dir = getSecretsDir();
    await mkdir(dir, { recursive: true });
    await chmod(dir, 0o700);

    const filePath = join(dir, `${group}.env`);
    const existing = await loadEnvFile(filePath);
    existing[key] = value;
    await writeEnvFile(filePath, existing);
    console.log(chalk.green(`Set ${key} in group "${group}"`));
  });

secretsCommand
  .command('get')
  .description('Get a secret from a group')
  .argument('<group>', 'Secret group name')
  .argument('<key>', 'Secret key')
  .action(async (group: string, key: string) => {
    const filePath = join(getSecretsDir(), `${group}.env`);
    const existing = await loadEnvFile(filePath);
    if (key in existing) {
      console.log(existing[key]);
    } else {
      console.error(chalk.red(`Key "${key}" not found in group "${group}"`));
      process.exit(1);
    }
  });

secretsCommand
  .command('list')
  .description('List secret groups or keys in a group')
  .argument('[group]', 'Secret group name (omit to list all groups)')
  .action(async (group?: string) => {
    const dir = getSecretsDir();

    if (!group) {
      // List all groups
      let files: string[];
      try {
        files = await readdir(dir);
      } catch {
        console.log(chalk.dim('No secret groups found.'));
        return;
      }
      const groups = files.filter(f => f.endsWith('.env')).map(f => f.replace('.env', ''));
      if (groups.length === 0) {
        console.log(chalk.dim('No secret groups found.'));
        return;
      }
      console.log(chalk.bold('\nSecret Groups:\n'));
      for (const g of groups) {
        const envFile = await loadEnvFile(join(dir, `${g}.env`));
        const count = Object.keys(envFile).length;
        console.log(`  ${g} (${count} keys)`);
      }
      return;
    }

    // List keys in a group
    const filePath = join(dir, `${group}.env`);
    const existing = await loadEnvFile(filePath);
    const keys = Object.keys(existing);
    if (keys.length === 0) {
      console.log(chalk.dim(`No secrets in group "${group}".`));
      return;
    }
    console.log(chalk.bold(`\nSecrets in "${group}":\n`));
    for (const key of keys) {
      // Show key but mask value
      const val = existing[key]!;
      const masked = val.length > 4 ? val.slice(0, 2) + '*'.repeat(val.length - 4) + val.slice(-2) : '****';
      console.log(`  ${key}=${masked}`);
    }
  });

secretsCommand
  .command('delete')
  .description('Delete a secret or group')
  .argument('<group>', 'Secret group name')
  .argument('[key]', 'Secret key (omit to delete entire group)')
  .action(async (group: string, key?: string) => {
    const dir = getSecretsDir();
    const filePath = join(dir, `${group}.env`);

    if (!key) {
      // Delete entire group
      try {
        await unlink(filePath);
        console.log(chalk.green(`Deleted secret group: ${group}`));
      } catch {
        console.error(chalk.red(`Group "${group}" not found.`));
        process.exit(1);
      }
      return;
    }

    // Delete single key
    const existing = await loadEnvFile(filePath);
    if (!(key in existing)) {
      console.error(chalk.red(`Key "${key}" not found in group "${group}"`));
      process.exit(1);
    }
    delete existing[key];
    await writeEnvFile(filePath, existing);
    console.log(chalk.green(`Deleted ${key} from group "${group}"`));
  });

async function loadEnvFile(filePath: string): Promise<Record<string, string>> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const k = trimmed.slice(0, eqIdx).trim();
      let v = trimmed.slice(eqIdx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
    }
    return env;
  } catch {
    return {};
  }
}

async function writeEnvFile(filePath: string, env: Record<string, string>): Promise<void> {
  const lines = Object.entries(env).map(([k, v]) => {
    if (v.includes(' ') || v.includes('"') || v.includes("'")) {
      return `${k}="${v.replace(/"/g, '\\"')}"`;
    }
    return `${k}=${v}`;
  });
  await writeFile(filePath, lines.join('\n') + '\n');
}
