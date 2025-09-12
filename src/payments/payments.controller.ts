import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Post()
  async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.createPayment(createPaymentDto);
  }

  @Post(':id/confirm')
  async confirmPayment(
    @Param('id') id: string,
    @Body() body: { paymentIntentId: string },
  ) {
    return this.paymentsService.confirmPayment(id, body.paymentIntentId);
  }

  @Post(':id/refund')
  async refundPayment(
    @Param('id') id: string,
    @Body() body: { amount?: number },
  ) {
    return this.paymentsService.refundPayment(id, body.amount);
  }

  @Get('user/:userId')
  async getUserPayments(@Param('userId') userId: string) {
    return this.paymentsService.getUserPayments(userId);
  }

  @Get('analytics')
  async getPaymentAnalytics() {
    return this.paymentsService.getPaymentAnalytics();
  }

  @Post('subscriptions')
  async createSubscription(
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ) {
    return this.subscriptionsService.createSubscription(createSubscriptionDto);
  }

  @Get('subscriptions/user/:userId')
  async getUserSubscriptions(@Param('userId') userId: string) {
    return this.subscriptionsService.getUserSubscriptions(userId);
  }

  @Post('subscriptions/:id/cancel')
  async cancelSubscription(@Param('id') id: string) {
    return this.subscriptionsService.cancelSubscription(id);
  }

  @Get('subscriptions/active')
  async getActiveSubscriptions() {
    return this.subscriptionsService.getActiveSubscriptions();
  }
}
