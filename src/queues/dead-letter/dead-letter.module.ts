import { Module } from '@nestjs/common';
import { QueueModule } from '../queue.module';
import { DeadLetterService } from './dead-letter.service';

@Module({
  imports: [QueueModule],
  providers: [DeadLetterService],
  exports: [DeadLetterService],
})
export class DeadLetterModule {}
