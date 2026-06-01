import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Notification } from './entities/notification.entity';
import { NotificationsQueueService } from './notifications.queue';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), ScheduleModule],
  providers: [NotificationsQueueService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
