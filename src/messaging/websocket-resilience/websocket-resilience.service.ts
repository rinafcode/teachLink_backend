import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { ConnectionSessionService } from './connection-session.service';
import {
  calculateReconnectDelay,
  isBackpressureActive,
  WS_HEARTBEAT_INTERVAL_MS,
  WS_HEARTBEAT_TIMEOUT_MS,
} from '../../common/utils/websocket.utils';

@Injectable()
export class WebSocketResilienceService {
  private readonly logger = new Logger(WebSocketResilienceService.name);
  private heartbeatTimer: NodeJS.Timeout;

  constructor(private readonly sessionService: ConnectionSessionService) {}

  startHeartbeat(server: Server): void {
    if (this.heartbeatTimer) {
      return;
    }
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const socketMap = server.sockets.sockets as any;
      if (socketMap && typeof socketMap.forEach === 'function') {
        socketMap.forEach((socket: any) => {
          const session = this.sessionService.getBySocket(socket.id);
          if (!session) {
            return;
          }
          if (now - session.lastPongAt > WS_HEARTBEAT_INTERVAL_MS + WS_HEARTBEAT_TIMEOUT_MS) {
            this.logger.warn(`Stale connection ${socket.id}, disconnecting`);
            socket.disconnect(true);
            return;
          }
          socket.emit('ping', { ts: now });
        });
      }
    }, WS_HEARTBEAT_INTERVAL_MS);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  emitOrQueue(server: Server, userId: string, event: string, payload: unknown): void {
    const session = this.sessionService.getByUser(userId);
    if (!session) {
      this.sessionService.enqueueForUser(userId, event, payload);
      return;
    }
    if (isBackpressureActive(this.sessionService.pendingCount(userId))) {
      this.sessionService.enqueueForUser(userId, event, payload);
      return;
    }
    server.to(userId).emit(event, payload);
  }

  replayPending(server: Server, socketId: string, lastSeq: number): void {
    const pending = this.sessionService.drainPending(socketId, lastSeq);
    const socketMap = server.sockets.sockets as any;
    const socket = socketMap?.get
      ? socketMap.get(socketId)
      : ((socketMap && socketMap[socketId]) ?? null);
    if (!socket) {
      return;
    }
    for (const message of pending) {
      const payload =
        typeof message.payload === 'object' && message.payload
          ? { ...message.payload, _seq: message.seq, _replayed: true }
          : message.payload;
      socket.emit(message.event, payload);
    }
    if (pending.length > 0) {
      this.logger.log(`Replayed ${pending.length} messages to socket ${socketId}`);
    }
  }

  getReconnectDelay(attempt: number): number {
    return calculateReconnectDelay(attempt);
  }
}
