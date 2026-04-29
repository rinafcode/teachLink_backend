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
import { WsJwtAuthGuard } from '../../auth/guards/ws-jwt-auth.guard';
import { Notification } from '../../notifications/entities/notification.entity';
import { wsManager } from '../../common/utils/websocket.utils';
import { WsThrottlerGuard } from '../../common/guards/ws-throttler.guard';
import { NOTIFICATION_GATEWAY_EVENTS } from '../../collaboration/constants/collaboration-events.constants';
import { JwtService } from '@nestjs/jwt';

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

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Connection attempt without token: ${client.id}`);
        client.emit('error', { message: 'Unauthorized: No token provided' });
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload.sub || payload.id;
      const roles = payload.roles || [];

      if (!userId) {
        throw new Error('User ID not found in token');
      }

      const registered = wsManager.registerConnection(userId, client);
      if (!registered) {
        // Connection rejected by wsManager (e.g. limit reached)
        return;
      }

      // Join default channels
      client.join(`user:${userId}`);
      client.join('broadcast');

      // Join role-based channels
      if (Array.isArray(roles)) {
        roles.forEach((role: string) => {
          client.join(`role:${role}`);
          this.logger.debug(`Client ${client.id} joined role channel: role:${role}`);
        });
      }

      this.logger.log(`Client connected and authenticated: ${client.id} (User: ${userId})`);
      client.emit('authenticated', { userId });
    } catch (error) {
      this.logger.error(`Connection authentication failed: ${error.message}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    wsManager.cleanupSocket(client);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage(NOTIFICATION_GATEWAY_EVENTS.SUBSCRIBE)
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId?: string },
  ) {
    const user = (client as any).user;
    const userId = user?.id || user?.sub || data?.userId;

    if (!userId) {
      this.logger.warn(`Subscription attempt without user context: ${client.id}`);
      return { status: 'error', message: 'User context missing' };
    }

    // Re-ensure joined to user channel if needed
    client.join(`user:${userId}`);
    this.logger.log(`User ${userId} explicitly subscribed to notifications`);

    return { status: 'subscribed', userId };
  }

  /**
   * Send notification to a specific user in real-time
   */
  async sendToUser(userId: string, notification: Notification) {
    this.server.to(`user:${userId}`).emit(NOTIFICATION_GATEWAY_EVENTS.NOTIFICATION, notification);
    this.logger.debug(`Notification sent to user:${userId}`);
  }

  /**
   * Send notification to a specific role in real-time
   */
  async sendToRole(role: string, notification: Partial<Notification>) {
    this.server.to(`role:${role}`).emit(NOTIFICATION_GATEWAY_EVENTS.NOTIFICATION, notification);
    this.logger.debug(`Notification sent to role:${role}`);
  }

  /**
   * Broadcast notification to all connected users
   */
  async broadcast(notification: Partial<Notification>) {
    this.server.emit(NOTIFICATION_GATEWAY_EVENTS.BROADCAST_NOTIFICATION, notification);
    this.logger.debug('Broadcast notification sent');
  }
}
