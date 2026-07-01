import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { Enrollment } from '../../courses/entities/enrollment.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { UserConsent } from './entities/user-consent.entity';
import { SessionModule } from '../../session/session.module';
import { GdprService } from './gdpr.service';
import { GdprController } from './gdpr.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Enrollment, Payment, Notification, UserConsent]),
    SessionModule,
  ],
  providers: [GdprService],
  controllers: [GdprController],
})
export class GdprModule {}
