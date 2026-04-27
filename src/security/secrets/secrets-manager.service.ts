import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsManagerClient, GetSecretValueCommand, UpdateSecretCommand } from '@aws-sdk/client-secrets-manager';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface ISecretProvider {
  getSecret(secretName: string): Promise<string | null>;
  updateSecret(secretName: string, secretValue: string): Promise<void>;
  rotateSecret(secretName: string): Promise<void>;
}

@Injectable()
export class SecretsManagerService implements ISecretProvider, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SecretsManagerService.name);
  private secretsManager: SecretsManagerClient;
  private secretCache: Map<string, { value: string; expiry: number }> = new Map();
  private cacheTTL: number;

  constructor(private configService: ConfigService) {
    this.cacheTTL = this.configService.get<number>('SECRET_CACHE_TTL_MS', 300000); // 5 minutes default
  }

  async onModuleInit() {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    
    this.secretsManager = new SecretsManagerClient({
      region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });

    this.logger.log('AWS Secrets Manager initialized');
  }

  async onModuleDestroy() {
    await this.secretsManager.destroy();
    this.logger.log('AWS Secrets Manager client destroyed');
  }

  async getSecret(secretName: string): Promise<string | null> {
    // Check cache first
    const cached = this.secretCache.get(secretName);
    if (cached && cached.expiry > Date.now()) {
      this.logger.debug(`Cache hit for secret: ${secretName}`);
      return cached.value;
    }

    try {
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await this.secretsManager.send(command);
      
      if (response.SecretString) {
        // Cache the secret
        this.secretCache.set(secretName, {
          value: response.SecretString,
          expiry: Date.now() + this.cacheTTL,
        });
        
        this.logger.debug(`Retrieved secret: ${secretName}`);
        return response.SecretString;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to retrieve secret: ${secretName}`, error);
      return null;
    }
  }

  async updateSecret(secretName: string, secretValue: string): Promise<void> {
    try {
      const command = new UpdateSecretCommand({
        SecretId: secretName,
        SecretString: secretValue,
      });
      
      await this.secretsManager.send(command);
      
      // Invalidate cache
      this.secretCache.delete(secretName);
      
      this.logger.log(`Secret updated: ${secretName}`);
    } catch (error) {
      this.logger.error(`Failed to update secret: ${secretName}`, error);
      throw error;
    }
  }

  async rotateSecret(secretName: string): Promise<void> {
    this.logger.log(`Initiating rotation for secret: ${secretName}`);
    
    try {
      // Generate new secret value (implementation depends on secret type)
      const newSecret = this.generateSecretValue(secretName);
      
      await this.updateSecret(secretName, newSecret);
      
      this.logger.log(`Secret rotated successfully: ${secretName}`);
    } catch (error) {
      this.logger.error(`Failed to rotate secret: ${secretName}`, error);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async rotateCriticalSecrets() {
    const criticalSecrets = this.configService.get<string>('SECRETS_TO_ROTATE', '').split(',').filter(Boolean);
    
    for (const secretName of criticalSecrets) {
      try {
        await this.rotateSecret(secretName.trim());
      } catch (error) {
        this.logger.error(`Failed to rotate critical secret: ${secretName}`, error);
      }
    }
  }

  private generateSecretValue(secretName: string): string {
    // Generate a cryptographically secure random string
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  clearCache(): void {
    this.secretCache.clear();
    this.logger.log('Secret cache cleared');
  }
}
