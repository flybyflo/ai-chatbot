import type { NextApiRequest, NextApiResponse } from 'next';
import { WebSocketServer } from 'ws';
import { progressManager } from '@/lib/progress-manager';
import { elicitationManager } from '@/lib/elicitation-manager';
import { InboundMessage, OutboundMessage } from '@/lib/realtime/schema';

type WithWSS = NextApiResponse & { socket: any };

export default function handler(_req: NextApiRequest, res: WithWSS) {
  const server: any = res.socket?.server;
  if (server && !server.wss) {
    // Create a WebSocket server that we will attach via the HTTP upgrade event
    const wss = new WebSocketServer({ noServer: true });
    server.wss = wss;

    if (!server._wsUpgradeListenerAdded) {
      server._wsUpgradeListenerAdded = true;
      server.on('upgrade', (request: any, socket: any, head: Buffer) => {
        try {
          const { pathname } = new URL(request.url || '', 'http://localhost');
          console.log('[WS] upgrade event', {
            url: request.url,
            pathname,
            headers: request.headers,
          });
          if (pathname === '/api/socket') {
            wss.handleUpgrade(request, socket, head, (ws) => {
              wss.emit('connection', ws, request);
            });
          } else {
            try {
              socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
              socket.destroy();
            } catch {}
          }
        } catch (err) {
          try {
            socket.destroy();
          } catch {}
        }
      });
    }

    wss.on('connection', (ws: import('ws').WebSocket, request: any) => {
      console.log('[WS] client connected', {
        url: request?.url,
        headers: request?.headers,
      });
      ws.on('error', (err) => {
        console.log('[WS] socket error', err);
      });
      const send = (msg: unknown) => {
        try {
          // Validate outbound message before sending
          const valid = OutboundMessage.parse(msg);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(valid));
          }
        } catch {
          // ignore invalid
        }
      };

      const progressHandler = (p: any) => {
        if (p?.isCleanup) {
          console.log('[WS] sending progress cleanup', p.progressToken);
          send({ type: 'cleanup', kind: 'progress', token: p.progressToken });
          return;
        }
        console.log(
          '[WS] sending progress update',
          p.progressToken,
          p.currentProgress,
        );
        send({
          type: 'progress',
          toolName: p.toolName,
          serverName: p.serverName,
          progressToken: p.progressToken,
          currentProgress: p.currentProgress,
        });
      };

      const elicitationHandler = (e: any) => {
        if (e?.type === 'elicitation_cleanup') {
          console.log('[WS] sending elicitation cleanup', e.elicitationToken);
          send({
            type: 'cleanup',
            kind: 'elicitation',
            token: e.elicitationToken,
          });
          return;
        }
        if (e?.type === 'elicitation_request') {
          console.log('[WS] sending elicitation request', e.elicitationToken);
          send({
            type: 'elicitation',
            elicitationToken: e.elicitationToken,
            serverName: e.serverName,
            message: e.message,
            responseType: e.responseType,
            timestamp: e.timestamp,
          });
        }
      };

      progressManager.addUpdateHandler(progressHandler);
      elicitationManager.addUpdateHandler(elicitationHandler);

      // Send snapshots to newly connected client
      try {
        const active = progressManager.getAllActiveProgress();
        for (const p of active) {
          send({
            type: 'progress',
            toolName: p.toolName,
            serverName: p.serverName,
            progressToken: p.progressToken,
            currentProgress: p.currentProgress,
          });
        }
      } catch (err) {
        console.log('[WS] error sending progress snapshot', err);
      }
      try {
        const pending = elicitationManager.getPendingRequests?.();
        if (Array.isArray(pending)) {
          for (const r of pending) {
            const info = r.info;
            send({
              type: 'elicitation',
              elicitationToken: info.elicitationToken,
              serverName: info.serverName,
              message: info.message,
              responseType: info.responseType,
              timestamp: info.timestamp,
            });
          }
        }
      } catch (err) {
        console.log('[WS] error sending elicitation snapshot', err);
      }

      ws.on('message', (raw: unknown) => {
        try {
          const msg = InboundMessage.parse(JSON.parse(String(raw)));
          console.log('[WS] received inbound', msg.type);
          if (msg.type === 'elicitation_response') {
            elicitationManager.handleResponse({
              elicitationToken: msg.elicitationToken,
              action: msg.action,
              data: msg.data,
            });
          }
        } catch (err) {
          console.log('[WS] invalid inbound message', raw, err);
        }
      });

      ws.on('close', (code, reason) => {
        console.log('[WS] client disconnected', {
          code,
          reason: reason?.toString(),
        });
        progressManager.removeUpdateHandler(progressHandler);
        elicitationManager.removeUpdateHandler(elicitationHandler);
      });
    });
  }

  res.status(200).end();
}

export const config = {
  api: {
    bodyParser: false,
  },
};
