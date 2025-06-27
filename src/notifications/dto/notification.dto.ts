import { NotificationType } from '../entities/notification.entity';

export class NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  content: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
} 