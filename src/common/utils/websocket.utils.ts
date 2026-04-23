import { Socket } from 'socket.io';

type ConnectionMeta = {
  userId: string;
  lastSeen: number;
  isAlive: boolean;
};

class WebSocketManager {
  private connections = new Map<string, Set<Socket>>(); // userId -> sockets
  private meta = new Map<string, ConnectionMeta>(); // socketId -> meta

  private MAX_CONNECTIONS_PER_USER = 3;
  private HEARTBEAT_INTERVAL = 30000; // 30s
  private TIMEOUT = 60000; // 60s

  startHeartbeat(io: any) {
    setInterval(() => {
      io.sockets.sockets.forEach((socket: Socket) => {
        const meta = this.meta.get(socket.id);

        if (!meta) return;

        if (!meta.isAlive) {
          socket.disconnect(true);
          this.cleanupSocket(socket);
          return;
        }

        meta.isAlive = false;
        socket.emit('ping');
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  handlePong(socket: Socket) {
    const meta = this.meta.get(socket.id);
    if (meta) {
      meta.isAlive = true;
      meta.lastSeen = Date.now();
    }
  }

  registerConnection(userId: string, socket: Socket) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }

    const userConnections = this.connections.get(userId) ?? new Set();
    const userConnections = this.connections.get(userId);
    if (!userConnections) {
      return;
    }

    // enforce max connections
    if (userConnections.size >= this.MAX_CONNECTIONS_PER_USER) {
      const oldestSocket = [...userConnections][0];
      oldestSocket.disconnect(true);
      this.cleanupSocket(oldestSocket);
    }

    userConnections.add(socket);

    this.meta.set(socket.id, {
      userId,
      lastSeen: Date.now(),
      isAlive: true,
    });
  }

  cleanupSocket(socket: Socket) {
    const meta = this.meta.get(socket.id);
    if (!meta) return;

    const userConnections = this.connections.get(meta.userId);

    userConnections?.delete(socket);

    if (userConnections && userConnections.size === 0) {
      this.connections.delete(meta.userId);
    }

    this.meta.delete(socket.id);
  }

  getActiveConnections(userId: string): number {
    return this.connections.get(userId)?.size || 0;
  }

  getTotalConnections(): number {
    return this.meta.size;
  }

  forceCleanup() {
    this.connections.clear();
    this.meta.clear();
  }
}

export const wsManager = new WebSocketManager();
