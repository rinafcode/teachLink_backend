import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { InstructorPayoutProfile } from '../entities/payout-profile.entity';
import { InstructorPayout } from '../entities/payout.entity';
import { Course } from '../../courses/entities/course.entity';
import { Payment } from '../entities/payment.entity';
import { Refund } from '../entities/refund.entity';
import { User } from '../../users/entities/user.entity';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InstructorPayoutProfile,
      InstructorPayout,
      Course,
      Payment,
      Refund,
      User,
    ]),
    NotificationsModule,
  ],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
