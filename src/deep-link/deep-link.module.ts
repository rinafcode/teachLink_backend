import { Module } from '@nestjs/common';
import { DeepLinkController } from './deep-link.controller';
import { DeepLinkService } from './deep-link.service';

@Module({
  controllers: [DeepLinkController],
  providers: [DeepLinkService],
})
export class DeepLinkModule {}
