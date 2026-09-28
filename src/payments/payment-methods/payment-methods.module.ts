import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { TIME } from '../../common/constants/time.constants';
import { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: TIME.ONE_MINUTE_MS,
        limit: 100,
      },
    ]),
    TypeOrmModule.forFeature([PaymentMethod]),
  ],
  controllers: [PaymentMethodsController],
  providers: [PaymentMethodsService],
  exports: [PaymentMethodsService],
})
export class PaymentMethodsModule {}
