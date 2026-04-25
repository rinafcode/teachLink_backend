import { IsString, IsEnum, IsOptional, IsNotEmpty, IsUUID } from 'class-validator';
import { PaymentMethod } from '../entities/payment.entity';
import { SubscriptionInterval } from '../entities/subscription.entity';
export class CreateSubscriptionDto {
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    courseId: string;
    @IsEnum(SubscriptionInterval)
    @IsNotEmpty()
    interval: SubscriptionInterval;
    @IsEnum(PaymentMethod)
    @IsNotEmpty()
    provider: PaymentMethod;
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    priceId: string;
    @IsOptional()
    @IsString()
    metadata?: Record<string, unknown>;
}
