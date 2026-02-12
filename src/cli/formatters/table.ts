import chalk from 'chalk';

export interface Column {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'right';
  color?: (value: string) => string;
}

export function formatTable(columns: Column[], rows: Record<string, string>[]): string {
  // Calculate column widths
  const widths = columns.map(col => {
    const maxContent = Math.max(
      col.header.length,
      ...rows.map(row => (row[col.key] ?? '').length),
    );
    return col.width ?? Math.min(maxContent, 40);
  });

  // Header
  const header = columns.map((col, i) => pad(col.header, widths[i]!, col.align)).join('  ');
  const separator = widths.map(w => '─'.repeat(w)).join('──');

  // Rows
  const lines = rows.map(row =>
    columns.map((col, i) => {
      const value = row[col.key] ?? '';
      const padded = pad(value, widths[i]!, col.align);
      return col.color ? col.color(padded) : padded;
    }).join('  '),
  );

  return [chalk.bold(header), separator, ...lines].join('\n');
}

function pad(str: string, width: number, align: 'left' | 'right' = 'left'): string {
  if (str.length >= width) return str.slice(0, width);
  const padding = ' '.repeat(width - str.length);
  return align === 'right' ? padding + str : str + padding;
}

export function statusColor(status: string): string {
  switch (status) {
    case 'active': return chalk.green(status);
    case 'paused': return chalk.yellow(status);
    case 'stopped': return chalk.gray(status);
    case 'failed': return chalk.red(status);
    default: return status;
  }
}

export function modeColor(mode: string): string {
  switch (mode) {
    case 'scheduled': return chalk.blue(mode);
    case 'watcher': return chalk.magenta(mode);
    case 'persistent': return chalk.cyan(mode);
    default: return mode;
  }
}
