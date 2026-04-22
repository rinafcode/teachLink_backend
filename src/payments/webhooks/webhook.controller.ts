import {
  Controller,
  Post,
  Headers,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  RawBodyRequest,
  VERSION_NEUTRAL,
  Version,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';

@ApiTags('webhooks')
@Version(VERSION_NEUTRAL)
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    return this.webhookService.handleStripeWebhook(req.rawBody, signature);
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
