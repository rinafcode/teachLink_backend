import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../common/constants/queue.constants';
import { MessagingService } from './messaging.service';
import { MessageController } from './message.controller';
import { MessageGateway } from './message.gateway';
import { Message } from './message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    BullModule.registerQueue({ name: QUEUE_NAMES.MESSAGE_QUEUE }),
  ],
  providers: [MessagingService, MessageGateway],
  controllers: [MessageController],
  exports: [MessagingService],
})
export class MessagingModule {}
