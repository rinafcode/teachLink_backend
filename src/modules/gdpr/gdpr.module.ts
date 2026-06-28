import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { Enrollment } from '../../courses/entities/enrollment.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { UserConsent } from './entities/user-consent.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Enrollment, Payment, Notification, UserConsent])],
  controllers: [GdprController],
  providers: [GdprService],
})
export class GdprModule {}
