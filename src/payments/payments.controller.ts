import { Controller, Post, Body, Param, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from '../common/constants/throttle.constants';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { RefundDto } from './dto/refund.dto';
import { UserRole } from '../users/entities/user.entity';
import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import {
  CreatePaymentIntentResult,
  CreateSubscriptionResult,
  ProcessRefundResult,
} from './interfaces/payment-provider.interface';

interface AuthenticatedRequest {
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
  @ApiOperation({ summary: 'Create a payment intent for course purchase' })
  @ApiResponse({ status: 201, description: 'Payment intent created' })
  async createPaymentIntent(
    @Request() req: AuthenticatedRequest,
    @Body() createPaymentDto: CreatePaymentDto,
  ): Promise<CreatePaymentIntentResult> {
    return this.paymentsService.createPaymentIntent(req.user.id, createPaymentDto);
  }

  @Post('subscriptions')
  @Throttle({ default: THROTTLE.AUTH_DEFAULT }) // 5 requests per hour
  @Roles(UserRole.STUDENT, UserRole.TEACHER)
  @ApiOperation({ summary: 'Create a subscription for premium course' })
  @ApiResponse({ status: 201, description: 'Subscription created' })
  async createSubscription(
    @Request() req: AuthenticatedRequest,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<CreateSubscriptionResult> {
    return this.paymentsService.createSubscription(req.user.id, createSubscriptionDto);
  }

  @Post('refund')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Process a refund' })
  @ApiResponse({ status: 200, description: 'Refund processed' })
  async processRefund(@Body() refundDto: RefundDto): Promise<ProcessRefundResult> {
    return this.paymentsService.processRefund(refundDto);
  }

  @Get('invoices/:paymentId')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get invoice for a payment' })
  @ApiResponse({ status: 200, description: 'Invoice retrieved' })
  async getInvoice(
    @Param('paymentId') paymentId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<Invoice> {
    return this.paymentsService.getInvoice(paymentId, req.user.id);
  }

  @Get('user/payments')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user payment history' })
  @ApiResponse({ status: 200, description: 'Payment history retrieved' })
  async getUserPayments(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit: number = 10,
    @Query('page') page: number = 1,
  ): Promise<Payment[]> {
    return this.paymentsService.getUserPayments(req.user.id, limit, page);
  }

  @Get('user/subscriptions')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user subscriptions' })
  @ApiResponse({ status: 200, description: 'Subscriptions retrieved' })
  async getUserSubscriptions(@Request() req: AuthenticatedRequest): Promise<Subscription[]> {
    return this.paymentsService.getUserSubscriptions(req.user.id);
  }
}
