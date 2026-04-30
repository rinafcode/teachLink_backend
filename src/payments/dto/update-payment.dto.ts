import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentDto } from './create-payment.dto';

/**
 * Defines the update Payment payload.
 */
export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {}
