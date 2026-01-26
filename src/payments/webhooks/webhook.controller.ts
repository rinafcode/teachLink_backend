import {
  Controller,
  Post,
  Headers,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { StripeWebhookGuard } from './stripe-webhook.guard';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StripeWebhookGuard)
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Body() payload: any,
  ) {
    return this.webhookService.handleStripeWebhook(payload, signature);
  }

  @Post('paypal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle PayPal webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handlePayPalWebhook(
    @Headers('paypal-transmission-id') transmissionId: string,
    @Headers('paypal-transmission-time') transmissionTime: string,
    @Headers('paypal-transmission-sig') transmissionSig: string,
    @Headers('paypal-cert-url') certUrl: string,
    @Headers('paypal-auth-algo') authAlgo: string,
    @Body() payload: any,
  ) {
    return this.webhookService.handlePayPalWebhook(
      payload,
      transmissionId,
      transmissionTime,
      transmissionSig,
      certUrl,
      authAlgo,
    );
  }
}