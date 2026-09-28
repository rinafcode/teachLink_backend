import { Injectable, Logger } from '@nestjs/common';
import { PendingWsMessage, WS_MAX_PENDING_MESSAGES } from '../../common/utils/websocket.utils';

export interface ClientSession {
  userId: string;
  socketId: string;
  lastSeq: number;
  pendingOutbound: PendingWsMessage[];
  connectedAt: number;
  lastPongAt: number;
}

@Injectable()
export class ConnectionSessionService {
  private readonly logger = new Logger(ConnectionSessionService.name);
  private readonly sessionsBySocket = new Map<string, ClientSession>();
  private readonly socketByUser = new Map<string, string>();
  private readonly offlineQueueByUser = new Map<string, PendingWsMessage[]>();

  register(userId: string, socketId: string): ClientSession {
    const existingSocket = this.socketByUser.get(userId);
    if (existingSocket) {
      this.sessionsBySocket.delete(existingSocket);
    }
    const session: ClientSession = {
      userId,
      socketId,
      lastSeq: 0,
      pendingOutbound: [],
      connectedAt: Date.now(),
      lastPongAt: Date.now(),
    };
    this.sessionsBySocket.set(socketId, session);
    this.socketByUser.set(userId, socketId);
    return session;
  }

  unregister(socketId: string): ClientSession | undefined {
    const session = this.sessionsBySocket.get(socketId);
    if (!session) {
      return undefined;
    }
    this.sessionsBySocket.delete(socketId);
    if (this.socketByUser.get(session.userId) === socketId) {
      this.socketByUser.delete(session.userId);
    }
    return session;
  }

  getBySocket(socketId: string): ClientSession | undefined {
    return this.sessionsBySocket.get(socketId);
  }

  getByUser(userId: string): ClientSession | undefined {
    const socketId = this.socketByUser.get(userId);
    return socketId ? this.sessionsBySocket.get(socketId) : undefined;
  }

  recordPong(socketId: string): void {
    const session = this.sessionsBySocket.get(socketId);
    if (session) {
      session.lastPongAt = Date.now();
    }
  }

  enqueueForUser(userId: string, event: string, payload: unknown): PendingWsMessage | null {
    const queue = this.getQueueForUser(userId);
    if (queue.length >= WS_MAX_PENDING_MESSAGES) {
      this.logger.warn(`Backpressure: dropping enqueue for user ${userId}`);
      return null;
    }
    const seq = this.nextSeq(userId);
    const message: PendingWsMessage = {
      id: `${userId}-${seq}`,
      event,
      payload,
      seq,
      enqueuedAt: Date.now(),
    };
    queue.push(message);
    const session = this.getByUser(userId);
    if (session) {
      session.pendingOutbound.push(message);
    }
    return message;
  }

  private getQueueForUser(userId: string): PendingWsMessage[] {
    if (!this.offlineQueueByUser.has(userId)) {
      this.offlineQueueByUser.set(userId, []);
    }
    return this.offlineQueueByUser.get(userId);
  }

  private nextSeq(userId: string): number {
    const session = this.getByUser(userId);
    if (session) {
      session.lastSeq += 1;
      return session.lastSeq;
    }
    const queue = this.getQueueForUser(userId);
    const last = queue.length > 0 ? queue[queue.length - 1].seq : 0;
    return last + 1;
  }

  drainPending(socketId: string, afterSeq = 0): PendingWsMessage[] {
    const session = this.sessionsBySocket.get(socketId);
    if (!session) {
      return [];
    }
    const queue = this.getQueueForUser(session.userId);
    const pending = queue.filter((m) => m.seq > afterSeq);
    const remaining = queue.filter((m) => m.seq <= afterSeq);
    this.offlineQueueByUser.set(session.userId, remaining);
    session.pendingOutbound = remaining;
    return pending;
  }

  pendingCount(userId: string): number {
    return this.getQueueForUser(userId).length;
  }
}
