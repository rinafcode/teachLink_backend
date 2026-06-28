import { Module } from '@nestjs/common';
import { CdnService } from './cdn.service';
import { CdnController } from './cdn.controller';

@Module({
  controllers: [CdnController],
  providers: [CdnService],
  exports: [CdnService],
})
export class CdnModule {}
