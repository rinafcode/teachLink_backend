import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionModule } from '../../session/session.module';
import { UserConsent } from './entities/user-consent.entity';
import { GdprService } from './gdpr.service';
import { GdprController } from './gdpr.controller';

@Module({
  imports: [SessionModule, TypeOrmModule.forFeature([UserConsent])],
  controllers: [GdprController],
  providers: [GdprService],
})
export class GdprModule {}
