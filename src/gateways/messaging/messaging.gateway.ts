import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect, } from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { WsJwtAuthGuard } from '../../auth/guards/ws-jwt-auth.guard';
import { WsThrottlerGuard } from '../../common/guards/ws-throttler.guard';
import { wsManager } from '../../common/utils/websocket.utils';
import { JwtService } from '@nestjs/jwt';
import { MESSAGING_GATEWAY_EVENTS } from '../../collaboration/constants/collaboration-events.constants';

/**
 * Handles messaging gateway events.
 */
@WebSocketGateway({ namespace: '/messaging' })
@UseGuards(WsThrottlerGuard)
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagingGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Handles connection.
   * @param client The client.
   * @returns The operation result.
   */
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
        return;
      }
      this.logger.log(`Client connected: ${client.id}`);
    } catch (_error) {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  /**
   * Handles disconnect.
   * @param client The client.
   * @returns The operation result.
   */
  handleDisconnect(client: Socket) {
    wsManager.cleanupSocket(client);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Handles message.
   * @param data The data to process.
   * @param client The client.
   * @returns The operation result.
   */
  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage(MESSAGING_GATEWAY_EVENTS.SEND_MESSAGE)
  async handleMessage(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const user = (client as any).user;
    return { userId: user.sub, message: data };
  }
}
