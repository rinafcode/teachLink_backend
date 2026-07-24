import { Module } from '@nestjs/common';
import { CdnService } from './cdn.service';
import { CdnEventListener } from './cdn-event.listener';
import { CdnController } from './cdn.controller';

@Module({
  controllers: [CdnController],
  providers: [CdnService, CdnEventListener],
  exports: [CdnService],
})
export class CdnModule {}
