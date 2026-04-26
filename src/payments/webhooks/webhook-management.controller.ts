import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { WebhookQueueService } from './webhook-queue.service';
import { WebhookRetry } from './entities/webhook-retry.entity';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookManagementController {
  constructor(private readonly webhookQueueService: WebhookQueueService) {}

  @Get('status/:id')
  @ApiOperation({ summary: 'Get webhook retry status' })
  @ApiResponse({ status: 200, description: 'Webhook status retrieved' })
  async getWebhookStatus(@Param('id') id: string): Promise<WebhookRetry | null> {
    return this.webhookQueueService.getWebhookStatus(id);
  }

  @Get('dead-letter')
  @ApiOperation({ summary: 'Get dead letter webhooks' })
  @ApiResponse({ status: 200, description: 'Dead letter webhooks retrieved' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 100 })
  async getDeadLetterWebhooks(@Query('limit') limit?: number): Promise<WebhookRetry[]> {
    return this.webhookQueueService.getDeadLetterWebhooks(limit || 100);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending webhooks' })
  @ApiResponse({ status: 200, description: 'Pending webhooks retrieved' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 100 })
  async getPendingWebhooks(@Query('limit') limit?: number): Promise<WebhookRetry[]> {
    return this.webhookQueueService.getPendingWebhooks(limit || 100);
  }

  @Get('processing')
  @ApiOperation({ summary: 'Get processing webhooks' })
  @ApiResponse({ status: 200, description: 'Processing webhooks retrieved' })
  async getProcessingWebhooks(): Promise<WebhookRetry[]> {
    return this.webhookQueueService.getProcessingWebhooks();
  }

  @Post('requeue/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Requeue a dead letter webhook' })
  @ApiResponse({ status: 200, description: 'Webhook requeued' })
  async requeueDeadLetterWebhook(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.webhookQueueService.requeueDeadLetterWebhook(id);
    return { success: true };
  }
}
