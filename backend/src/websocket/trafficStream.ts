import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { RequestLog } from '../types/index.js';

export class TrafficStreamServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private statsInterval: NodeJS.Timeout | null = null;
  private currentSecondRequests: number = 0;
  private currentSecondAllowed: number = 0;
  private currentSecondRejected: number = 0;

  public init(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws/traffic' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Send initial welcome & handshake
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        message: 'RateGuard Live Traffic Stream Connected',
        timestamp: new Date().toISOString(),
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    // 1-second pulse broadcasting aggregated per-second throughput
    this.statsInterval = setInterval(() => {
      this.broadcast({
        type: 'THROUGHPUT_PULSE',
        rps: this.currentSecondRequests,
        allowedRps: this.currentSecondAllowed,
        rejectedRps: this.currentSecondRejected,
        activeClients: this.clients.size,
        timestamp: new Date().toISOString(),
      });

      this.currentSecondRequests = 0;
      this.currentSecondAllowed = 0;
      this.currentSecondRejected = 0;
    }, 1000);
  }

  public broadcastRequest(log: RequestLog) {
    this.currentSecondRequests++;
    if (log.decision === 'ALLOWED') {
      this.currentSecondAllowed++;
    } else {
      this.currentSecondRejected++;
    }

    this.broadcast({
      type: 'REQUEST_EVENT',
      data: log,
    });
  }

  public broadcast(payload: any) {
    const message = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const trafficStream = new TrafficStreamServer();
