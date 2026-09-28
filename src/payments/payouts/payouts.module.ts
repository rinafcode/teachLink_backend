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
import { IdempotencyModule } from '../../common/modules/idempotency.module';

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
    // Issue #824 — IdempotencyModule is registered globally in AppModule;
    // importing it here is defensive so the @Idempotent() decorator on
    // PayoutsController.processPayout always resolves a wired
    // IdempotencyService even if AppModule ordering ever changes.
    IdempotencyModule,
  ],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
