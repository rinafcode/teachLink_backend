import { Controller, Post, Req, Res, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { StripeService } from '../providers/stripe.service';
import { PaymentsService } from '../payments.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaymentStatus } from '../enums';
import { SubscriptionStatus } from '../enums';

@Controller('payments/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly paymentsService: PaymentsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Post('stripe')
  async handleStripeWebhook(@Req() req: Request, @Res() res: Response) {
    const sig = req.headers['stripe-signature'] as string;
    let event;

    try {
      event = this.stripeService.handleWebhook(req.body, sig);
    } catch (err) {
      this.logger.error('Webhook signature verification failed', err);
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send(`Webhook Error: ${err.message}`);
    }

    // Handle event types
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        if (paymentIntent.metadata?.paymentId) {
          await this.paymentsService.updatePaymentStatus(
            paymentIntent.metadata.paymentId,
            PaymentStatus.COMPLETED,
            {
              providerTransactionId: paymentIntent.id,
              receiptUrl: paymentIntent.charges?.data[0]?.receipt_url,
            },
          );
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        if (paymentIntent.metadata?.paymentId) {
          await this.paymentsService.updatePaymentStatus(
            paymentIntent.metadata.paymentId,
            PaymentStatus.FAILED,
          );
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await this.subscriptionsService.updateSubscriptionStatus(
          subscription.id,
          subscription.status.toUpperCase() as SubscriptionStatus,
          new Date(subscription.current_period_start * 1000),
          new Date(subscription.current_period_end * 1000),
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await this.subscriptionsService.updateSubscriptionStatus(
          subscription.id,
          SubscriptionStatus.CANCELLED,
        );
        break;
      }
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    res.status(HttpStatus.OK).json({ received: true });
  }
}
