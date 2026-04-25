import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { WsJwtAuthGuard } from '../auth/guards/ws-jwt-auth.guard';
import { WsThrottlerGuard } from '../common/guards/ws-throttler.guard';
import { wsManager } from '../common/utils/websocket.utils';
import { JwtService } from '@nestjs/jwt';
import { NOTIFICATION_GATEWAY_EVENTS } from '../collaboration/constants/collaboration-events.constants';

@WebSocketGateway({ namespace: '/notifications' })
@UseGuards(WsThrottlerGuard)
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        throw new Error('No token provided');
      }

      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload.sub || payload.id;

      const registered = wsManager.registerConnection(userId, client);
      if (!registered) {
        // Connection rejected by global limits
        return;
      }
      this.logger.log(`Client connected: ${client.id}`);
    } catch (_error) {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    wsManager.cleanupSocket(client);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage(NOTIFICATION_GATEWAY_EVENTS.SUBSCRIBE_NOTIFICATIONS)
  async handleSubscribe(@ConnectedSocket() client: Socket) {
    const user = (client as any).user;
    return { userId: user.sub, subscribed: true };
  }
}
