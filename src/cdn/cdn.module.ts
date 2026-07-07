import { Module } from '@nestjs/common';
import { CdnService } from './cdn.service';
import { CdnEventListener } from './cdn-event.listener';

@Module({
  providers: [CdnService, CdnEventListener],
  exports: [CdnService],
})
export class CdnModule {}
