import {
  Controller,
  Post,
  Headers,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  RawBodyRequest,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { WebhookService } from './webhook.service';
import { StripeWebhookGuard } from './stripe-webhook.guard';

/**
 * Exposes webhook endpoints.
 */
@SkipThrottle()
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Handles stripe Webhook.
   * @param signature The signature.
   * @param req The req.
   * @returns The operation result.
   */
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StripeWebhookGuard)
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<any> {
    return this.webhookService.handleStripeWebhook(req.rawBody, signature);
  }

  /**
   * Handles pay Pal Webhook.
   * @param transmissionId The transmission identifier.
   * @param transmissionTime The transmission time.
   * @param transmissionSig The transmission sig.
   * @param certUrl The cert url.
   * @param authAlgo The auth algo.
   * @param payload The payload to process.
   * @returns The operation result.
   */
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
  ): Promise<any> {
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
