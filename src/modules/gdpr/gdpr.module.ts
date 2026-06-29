import { Module } from '@nestjs/common';
import { SessionModule } from '../../session/session.module';

@Module({
  imports: [SessionModule],
  controllers: [GdprController],
  providers: [GdprService],
})
export class GdprModule {}
