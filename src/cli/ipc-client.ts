import { createConnection } from 'node:net';
import { randomUUID } from 'node:crypto';
import { getSocketPath } from '../core/config.js';
import type { IpcRequest, IpcResponse } from '../types/index.js';

export async function sendIpcRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
  const socketPath = getSocketPath();

  return new Promise((resolve, reject) => {
    const client = createConnection(socketPath);
    const request: IpcRequest = {
      id: randomUUID(),
      method,
      params,
    };

    let data = '';

    client.on('connect', () => {
      client.write(JSON.stringify(request) + '\n');
    });

    client.on('data', (chunk) => {
      data += chunk.toString();
      const newlineIdx = data.indexOf('\n');
      if (newlineIdx !== -1) {
        const line = data.slice(0, newlineIdx);
        try {
          const response: IpcResponse = JSON.parse(line);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.result);
          }
        } catch (err) {
          reject(new Error(`Invalid response: ${line}`));
        }
        client.end();
      }
    });

    client.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT' ||
          (err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
        reject(new Error('Daemon is not running. Start with: cx daemon start'));
      } else {
        reject(err);
      }
    });

    client.setTimeout(10000, () => {
      client.destroy();
      reject(new Error('Connection timed out'));
    });
  });
}
