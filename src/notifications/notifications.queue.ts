import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { NotificationStatus } from './entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsQueueService {
  private readonly logger = new Logger(NotificationsQueueService.name);
  private readonly sqsClient: SQSClient;
  private readonly snsClient: SNSClient;
  private readonly queueUrl: string;
  private readonly snsTopicArn: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    this.sqsClient = new SQSClient({ region });
    this.snsClient = new SNSClient({ region });
    this.queueUrl = this.configService.get<string>('AWS_SQS_NOTIFICATION_QUEUE_URL');
    this.snsTopicArn = this.configService.get<string>('AWS_SNS_NOTIFICATION_TOPIC_ARN');
  }

  /**
   * Publish notification to SNS topic
   */
  async publishToTopic(notification: Notification): Promise<void> {
    try {
      const command = new PublishCommand({
        TopicArn: this.snsTopicArn,
        Message: JSON.stringify({
          id: notification.id,
          userId: notification.userId,
          title: notification.title,
          content: notification.content,
          type: notification.type,
          metadata: notification.metadata,
        }),
        MessageAttributes: {
          type: { DataType: 'String', StringValue: notification.type },
          priority: { DataType: 'String', StringValue: notification.priority },
        },
      });

      await this.snsClient.send(command);
      this.logger.log(`Notification ${notification.id} published to SNS topic`);
      
      await this.notificationRepository.update(notification.id, {
        status: NotificationStatus.SENT,
        lastAttemptAt: new Date(),
        deliveryAttempts: notification.deliveryAttempts + 1,
      });
    } catch (error) {
      this.logger.error(`Failed to publish notification ${notification.id} to SNS`, error.stack);
      await this.handleFailure(notification, error.message);
    }
  }

  /**
   * Handle notification failure with exponential backoff logic
   */
  private async handleFailure(notification: Notification, reason: string): Promise<void> {
    const nextAttempt = notification.deliveryAttempts + 1;
    const maxAttempts = 5;

    if (nextAttempt >= maxAttempts) {
      await this.notificationRepository.update(notification.id, {
        status: NotificationStatus.FAILED,
        failureReason: `Max attempts reached. Last error: ${reason}`,
        lastAttemptAt: new Date(),
      });
      this.logger.error(`Notification ${notification.id} permanently failed after ${maxAttempts} attempts`);
    } else {
      // Calculate backoff: 2^attempt * 1000ms
      const delaySeconds = Math.pow(2, nextAttempt);
      
      await this.notificationRepository.update(notification.id, {
        status: NotificationStatus.RETRYING,
        failureReason: reason,
        deliveryAttempts: nextAttempt,
        lastAttemptAt: new Date(),
      });

      // In a real SQS setup, we would send this back to the queue with a delay
      await this.enqueueWithDelay(notification, delaySeconds);
      
      this.logger.warn(`Notification ${notification.id} scheduled for retry in ${delaySeconds}s (Attempt ${nextAttempt})`);
    }
  }

  /**
   * Enqueue message with delay for exponential backoff
   */
  private async enqueueWithDelay(notification: Notification, delaySeconds: number): Promise<void> {
    try {
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({ id: notification.id }),
        DelaySeconds: Math.min(delaySeconds, 900), // SQS max delay is 15 mins (900s)
      });

      await this.sqsClient.send(command);
    } catch (error) {
      this.logger.error(`Failed to enqueue retry for notification ${notification.id}`, error.stack);
    }
  }
}
