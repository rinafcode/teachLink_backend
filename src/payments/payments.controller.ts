import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, IApiResponse, ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from '../common/constants/throttle.constants';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Idempotent } from '../common/decorators/idempotency.decorator';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { RefundDto } from './dto/refund.dto';
import { UserRole } from '../users/entities/user.entity';
import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import {
  ICreatePaymentIntentResult,
  ICreateSubscriptionResult,
  IProcessRefundResult,
} from './interfaces/payment-provider.interface';

interface IAuthenticatedRequest {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  @Throttle({ default: THROTTLE.MODERATE }) // 10 requests per hour
  @Roles(UserRole.STUDENT, UserRole.TEACHER)
  @Idempotent({ ttl: 86400 })
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'X-Idempotency-Key',
    description: 'Unique key for idempotent requests',
    required: true,
  })
  @ApiOperation({ summary: 'Create a payment intent for course purchase' })
  @IApiResponse({ status: 201, description: 'Payment intent created' })
  async createPaymentIntent(
    @Request() req: IAuthenticatedRequest,
    @Body() createPaymentDto: CreatePaymentDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ICreatePaymentIntentResult> {
    return this.paymentsService.createPaymentIntent(req.user.id, createPaymentDto, idempotencyKey);
  }

  @Post('subscriptions')
  @Throttle({ default: THROTTLE.AUTH_DEFAULT }) // 5 requests per hour
  @Roles(UserRole.STUDENT, UserRole.TEACHER)
  @Idempotent({ ttl: 86400 })
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'X-Idempotency-Key',
    description: 'Unique key for idempotent requests',
    required: true,
  })
  @ApiOperation({ summary: 'Create a subscription for premium course' })
  @IApiResponse({ status: 201, description: 'Subscription created' })
  async createSubscription(
    @Request() req: IAuthenticatedRequest,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ICreateSubscriptionResult> {
    return this.paymentsService.createSubscription(
      req.user.id,
      createSubscriptionDto,
      idempotencyKey,
    );
  }

  @Post('refund')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Idempotent({ ttl: 86400 })
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'X-Idempotency-Key',
    description: 'Unique key for idempotent requests',
    required: true,
  })
  @ApiOperation({ summary: 'Process a refund' })
  @IApiResponse({ status: 200, description: 'Refund processed' })
  async processRefund(
    @Body() refundDto: RefundDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<IProcessRefundResult> {
    return this.paymentsService.processRefund(refundDto, idempotencyKey);
  }

  @Get('invoices/:paymentId')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get invoice for a payment' })
  @IApiResponse({ status: 200, description: 'Invoice retrieved' })
  async getInvoice(
    @Param('paymentId') paymentId: string,
    @Request() req: IAuthenticatedRequest,
  ): Promise<Invoice> {
    return this.paymentsService.getInvoice(paymentId, req.user.id);
  }

  @Get('user/payments')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user payment history' })
  @IApiResponse({ status: 200, description: 'Payment history retrieved' })
  async getUserPayments(
    @Request() req: IAuthenticatedRequest,
    @Query('limit') limit: number = 10,
    @Query('page') page: number = 1,
  ): Promise<Payment[]> {
    return this.paymentsService.getUserPayments(req.user.id, limit, page);
  }

  @Get('user/subscriptions')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user subscriptions' })
  @IApiResponse({ status: 200, description: 'Subscriptions retrieved' })
  async getUserSubscriptions(@Request() req: IAuthenticatedRequest): Promise<Subscription[]> {
    return this.paymentsService.getUserSubscriptions(req.user.id);
  }
}
