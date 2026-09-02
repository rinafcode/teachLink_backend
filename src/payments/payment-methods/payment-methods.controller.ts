import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from '../../common/constants/throttle.constants';
import { CustomThrottleGuard } from '../../common/guards/throttle.guard';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './payment-methods.dto';
import { Idempotent } from '../../common/decorators/idempotency.decorator';

@ApiTags('Payment Methods')
@UseGuards(CustomThrottleGuard)
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get()
  @ApiOperation({ summary: 'List saved payment methods for the current user' })
  @ApiQuery({ name: 'userId', required: true, description: 'User identifier' })
  @ApiResponse({ status: 200, description: 'Saved payment methods' })
  @Throttle({ default: THROTTLE.MODERATE })
  async list(@Query('userId') userId: string) {
    return this.paymentMethodsService.listMethods(userId);
  }

  @Post()
  @Idempotent()
  @ApiOperation({ summary: 'Add a new payment method' })
  @ApiQuery({ name: 'userId', required: true, description: 'User identifier' })
  @ApiResponse({ status: 201, description: 'Payment method added' })
  @Throttle({ default: THROTTLE.MODERATE })
  async create(@Query('userId') userId: string, @Body() dto: CreatePaymentMethodDto) {
    return this.paymentMethodsService.addMethod(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing payment method' })
  @ApiQuery({ name: 'userId', required: true, description: 'User identifier' })
  @ApiResponse({ status: 200, description: 'Payment method updated' })
  @Throttle({ default: THROTTLE.MODERATE })
  async update(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.paymentMethodsService.updateMethod(userId, id, dto);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set a payment method as the default' })
  @ApiQuery({ name: 'userId', required: true, description: 'User identifier' })
  @ApiResponse({ status: 200, description: 'Default payment method updated' })
  @Throttle({ default: THROTTLE.MODERATE })
  async setDefault(@Param('id') id: string, @Query('userId') userId: string) {
    return this.paymentMethodsService.setDefaultMethod(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a payment method' })
  @ApiQuery({ name: 'userId', required: true, description: 'User identifier' })
  @ApiResponse({ status: 204, description: 'Payment method removed' })
  @Throttle({ default: THROTTLE.MODERATE })
  async remove(@Param('id') id: string, @Query('userId') userId: string) {
    await this.paymentMethodsService.removeMethod(userId, id);
    return { success: true };
  }
}
