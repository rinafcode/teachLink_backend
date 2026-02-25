import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { RefundDto } from './dto/refund.dto';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  @Roles(UserRole.STUDENT, UserRole.TEACHER)
  @ApiOperation({ summary: 'Create a payment intent for course purchase' })
  @ApiResponse({ status: 201, description: 'Payment intent created' })
  async createPaymentIntent(
    @Request() req,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPaymentIntent(
      req.user.id,
      createPaymentDto,
    );
  }

  @Post('subscriptions')
  @Roles(UserRole.STUDENT, UserRole.TEACHER)
  @ApiOperation({ summary: 'Create a subscription for premium course' })
  @ApiResponse({ status: 201, description: 'Subscription created' })
  async createSubscription(
    @Request() req,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ) {
    return this.paymentsService.createSubscription(
      req.user.id,
      createSubscriptionDto,
    );
  }

  @Post('refund')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Process a refund' })
  @ApiResponse({ status: 200, description: 'Refund processed' })
  async processRefund(@Body() refundDto: RefundDto) {
    return this.paymentsService.processRefund(refundDto);
  }

  @Get('invoices/:paymentId')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get invoice for a payment' })
  @ApiResponse({ status: 200, description: 'Invoice retrieved' })
  async getInvoice(@Param('paymentId') paymentId: string, @Request() req) {
    return this.paymentsService.getInvoice(paymentId, req.user.id);
  }

  @Get('user/payments')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user payment history' })
  @ApiResponse({ status: 200, description: 'Payment history retrieved' })
  async getUserPayments(
    @Request() req,
    @Query('limit') limit: number = 10,
    @Query('page') page: number = 1,
  ) {
    return this.paymentsService.getUserPayments(req.user.id, limit, page);
  }

  @Get('user/subscriptions')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user subscriptions' })
  @ApiResponse({ status: 200, description: 'Subscriptions retrieved' })
  async getUserSubscriptions(@Request() req) {
    return this.paymentsService.getUserSubscriptions(req.user.id);
  }
}