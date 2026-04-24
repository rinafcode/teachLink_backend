import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { WsJwtAuthGuard } from '../auth/guards/ws-jwt-auth.guard';
import { Notification } from './entities/notification.entity';
import { wsManager } from '../common/utils/websocket.utils';
import { WsThrottlerGuard } from '../common/guards/ws-throttler.guard';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'notifications',
})
@UseGuards(WsThrottlerGuard)
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSockets: Map<string, Set<string>> = new Map();

  async handleConnection(client: Socket) {
    // Optionally we can get userId here from token if required, but currently it handles subscribe via message.
    // However, for connection limit we can temporarily register with client id if no token or if handled at subscribe.
    // Let's enforce global connection limits here.
    if (wsManager.getTotalConnections() >= 5000) {
      // Same as MAX_GLOBAL_CONNECTIONS
      client.emit('error', { message: 'Server is at maximum capacity' });
      client.disconnect(true);
      return;
    }
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    wsManager.cleanupSocket(client);
    this.logger.log(`Client disconnected: ${client.id}`);
    this.removeSocketId(client.id);
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const user = (client as any).user;
    const userId = user?.id || data.userId;

    if (!userId) {
      this.logger.warn(`User ID not found for client: ${client.id}`);
      return;
    }

    const registered = wsManager.registerConnection(userId, client);
    if (!registered) {
      return { status: 'error', message: 'Connection limit reached' };
    }

    this.addSocketId(userId, client.id);
    client.join(`user:${userId}`);
    this.logger.log(`User ${userId} subscribed to notifications via socket ${client.id}`);

    return { status: 'subscribed', userId };
  }

  /**
   * Send notification to a specific user in real-time
   */
  async sendToUser(userId: string, notification: Notification) {
    this.server.to(`user:${userId}`).emit('notification', notification);
    this.logger.debug(`Notification sent to user:${userId}`);
  }

  /**
   * Broadcast notification to all users
   */
  async broadcast(notification: Partial<Notification>) {
    this.server.emit('broadcast_notification', notification);
    this.logger.debug('Broadcast notification sent');
  }

  private addSocketId(userId: string, socketId: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)?.add(socketId);
  }

  private removeSocketId(socketId: string) {
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.has(socketId)) {
        sockets.delete(socketId);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
        break;
      }
    }
  }
}
