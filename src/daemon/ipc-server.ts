import { createServer, type Server, type Socket } from 'node:net';
import { unlink } from 'node:fs/promises';
import { getSocketPath } from '../core/config.js';
import type { IpcRequest, IpcResponse } from '../types/index.js';

export type IpcHandler = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

let server: Server | null = null;

export async function startIpcServer(handler: IpcHandler): Promise<void> {
  const socketPath = getSocketPath();

  // Clean up stale socket
  try { await unlink(socketPath); } catch {}

  server = createServer((socket: Socket) => {
    let buffer = '';

    socket.on('data', async (chunk) => {
      buffer += chunk.toString();
      const newlineIdx = buffer.indexOf('\n');
      if (newlineIdx === -1) return;

      const line = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);

      let request: IpcRequest;
      try {
        request = JSON.parse(line);
      } catch {
        const response: IpcResponse = { id: '', error: 'Invalid JSON' };
        socket.write(JSON.stringify(response) + '\n');
        return;
      }

      try {
        const result = await handler(request.method, request.params);
        const response: IpcResponse = { id: request.id, result };
        socket.write(JSON.stringify(response) + '\n');
      } catch (err) {
        const response: IpcResponse = {
          id: request.id,
          error: err instanceof Error ? err.message : String(err),
        };
        socket.write(JSON.stringify(response) + '\n');
      }
    });

    socket.on('error', () => {
      // Client disconnected, ignore
    });
  });

  return new Promise((resolve, reject) => {
    server!.listen(socketPath, () => resolve());
    server!.on('error', reject);
  });
}

export async function stopIpcServer(): Promise<void> {
  if (!server) return;
  return new Promise((resolve) => {
    server!.close(() => resolve());
    server = null;
  });
}
