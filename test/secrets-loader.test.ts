import { describe, it, expect } from 'vitest';

// Test the env file parsing logic inline since it's a private function
function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

describe('env file parsing', () => {
  it('parses simple key=value', () => {
    const result = parseEnvFile('FOO=bar\nBAZ=qux');
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('handles quoted values', () => {
    const result = parseEnvFile('KEY="value with spaces"\nKEY2=\'single quoted\'');
    expect(result.KEY).toBe('value with spaces');
    expect(result.KEY2).toBe('single quoted');
  });

  it('skips comments and empty lines', () => {
    const result = parseEnvFile('# comment\n\nKEY=val\n  # another comment');
    expect(result).toEqual({ KEY: 'val' });
  });

  it('handles values with equals signs', () => {
    const result = parseEnvFile('URL=https://example.com?foo=bar');
    expect(result.URL).toBe('https://example.com?foo=bar');
  });
});
