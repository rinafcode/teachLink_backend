import { Module } from '@nestjs/common';
import { CdnService } from './cdn.service';

@Module({
  providers: [CdnService],
  exports: [CdnService],
})
export class CdnModule {}
