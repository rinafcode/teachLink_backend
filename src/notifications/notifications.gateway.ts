import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './entities/notification.entity';

@WebSocketGateway({ cors: true })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, string> = new Map(); // userId -> socketId

  constructor(private readonly notificationsService: NotificationsService) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.userSockets.set(userId, client.id);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [userId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        this.userSockets.delete(userId);
        break;
      }
    }
  }

  async sendNotification(userId: string, type: NotificationType, content: string) {
    const notification = await this.notificationsService.createNotification(userId, type, content);
    if (notification) {
      const socketId = this.userSockets.get(userId);
      if (socketId) {
        this.server.to(socketId).emit('notification', notification);
      }
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(@MessageBody() notificationId: string) {
    await this.notificationsService.markAsRead(notificationId);
  }

  @SubscribeMessage('getNotifications')
  async handleGetNotifications(@MessageBody() userId: string, @ConnectedSocket() client: Socket) {
    const notifications = await this.notificationsService.getUserNotifications(userId);
    client.emit('notifications', notifications);
  }
} 