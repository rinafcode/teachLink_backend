import { Module } from '@nestjs/common';
import { DeepLinkController } from './deep-link.controller';

@Module({
  controllers: [DeepLinkController],
})
export class DeepLinkModule {}
