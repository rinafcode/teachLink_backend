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
import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto, NotificationResponseDto } from './dto/notification.dto';
import { Notification } from './entities/notification.entity';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedUsers = new Map<string, string[]>(); // userId -> socketIds[]

  constructor(private notificationsService: NotificationsService) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // In a real app, you'd extract userId from JWT token
      const userId = client.handshake.query.userId as string;
      
      if (!userId) {
        client.disconnect();
        return;
      }

      client.userId = userId;
      
      // Store user connection
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, []);
      }
      this.connectedUsers.get(userId)?.push(client.id);

      // Join user to their personal room
      await client.join(`user_${userId}`);
      
      this.logger.log(`User ${userId} connected with socket ${client.id}`);

      // Send unread count on connection
      const unreadCount = await this.notificationsService.getUnreadCount(userId);
      client.emit('unread_count', { count: unreadCount });

    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.userId;
    
    if (userId && this.connectedUsers.has(userId)) {
      const sockets = this.connectedUsers.get(userId) || [];
      const updatedSockets = sockets.filter(id => id !== client.id);
      
      if (updatedSockets.length === 0) {
        this.connectedUsers.delete(userId);
      } else {
        this.connectedUsers.set(userId, updatedSockets);
      }
    }

    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('get_notifications')
  async handleGetNotifications(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { page?: number; limit?: number; isRead?: boolean }
  ) {
    try {
      if (!client.userId) {
        return { error: 'Unauthorized' };
      }

      const result = await this.notificationsService.findAll(client.userId, data);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Error getting notifications:', error);
      return { error: 'Failed to get notifications' };
    }
  }

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string }
  ) {
    try {
      if (!client.userId) {
        return { error: 'Unauthorized' };
      }

      await this.notificationsService.markAsRead(data.notificationId, client.userId);
      
      // Update unread count
      const unreadCount = await this.notificationsService.getUnreadCount(client.userId);
      client.emit('unread_count', { count: unreadCount });

      return { success: true };
    } catch (error) {
      this.logger.error('Error marking notification as read:', error);
      return { error: 'Failed to mark as read' };
    }
  }

  @SubscribeMessage('mark_all_as_read')
  async handleMarkAllAsRead(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      if (!client.userId) {
        return { error: 'Unauthorized' };
      }

      await this.notificationsService.markAllAsRead(client.userId);
      
      // Update unread count
      client.emit('unread_count', { count: 0 });

      return { success: true };
    } catch (error) {
      this.logger.error('Error marking all notifications as read:', error);
      return { error: 'Failed to mark all as read' };
    }
  }

  @SubscribeMessage('get_unread_count')
  async handleGetUnreadCount(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      if (!client.userId) {
        return { error: 'Unauthorized' };
      }

      const count = await this.notificationsService.getUnreadCount(client.userId);
      return { success: true, count };
    } catch (error) {
      this.logger.error('Error getting unread count:', error);
      return { error: 'Failed to get unread count' };
    }
  }

  // Method to send notification to specific user
  async sendNotificationToUser(userId: string, notification: NotificationResponseDto) {
    const userRoom = `user_${userId}`;
    
    // Check if user can receive this notification
    const canReceive = await this.notificationsService.canUserReceiveNotification(
      userId, 
      notification.type
    );

    if (!canReceive) {
      return;
    }

    // Send notification to user's room
    this.server.to(userRoom).emit('new_notification', notification);
    
    // Update unread count
    const unreadCount = await this.notificationsService.getUnreadCount(userId);
    this.server.to(userRoom).emit('unread_count', { count: unreadCount });

    this.logger.log(`Notification sent to user ${userId}: ${notification.title}`);
  }

  // Method to broadcast notification to multiple users
  async broadcastNotification(userIds: string[], notification: Omit<CreateNotificationDto, 'userId'>) {
    const notifications = await this.notificationsService.createBulkNotifications(userIds, notification);
    
    for (const notif of notifications) {
      await this.sendNotificationToUser(notif.userId, {
        id: notif.id,
        userId: notif.userId,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        priority: notif.priority,
        isRead: notif.isRead,
        metadata: notif.metadata,
        actionUrl: notif.actionUrl,
        createdAt: notif.createdAt,
        readAt: notif.readAt
      });
    }
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Get online users count
  getOnlineUsersCount(): number {
    return this.connectedUsers.size;
  }
}