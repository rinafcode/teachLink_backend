import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISecretProvider } from './secrets-manager.service';
import * as https from 'https';
import * as crypto from 'crypto';

interface IVaultSecret {
  data: {
    data: Record<string, string>;
  };
}

@Injectable()
export class VaultSecretsService implements ISecretProvider, OnModuleInit {
  private readonly logger = new Logger(VaultSecretsService.name);
  private vaultUrl: string;
  private vaultToken: string;
  private vaultPath: string;
  private enabled: boolean = false;

  constructor(private configService: ConfigService) {
    this.vaultUrl = this.configService.get<string>('VAULT_ADDR', '');
    this.vaultToken = this.configService.get<string>('VAULT_TOKEN', '');
    this.vaultPath = this.configService.get<string>('VAULT_SECRET_PATH', 'secret/data');
    this.enabled = !!this.vaultUrl && !!this.vaultToken;
  }

  async onModuleInit() {
    if (this.enabled) {
      this.logger.log('HashiCorp Vault integration initialized');
    } else {
      this.logger.warn('Vault integration disabled - missing VAULT_ADDR or VAULT_TOKEN');
    }
  }

  async getSecret(secretName: string): Promise<string | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const url = `${this.vaultUrl}/v1/${this.vaultPath}/${secretName}`;
      const response = await this.makeVaultRequest(url, 'GET');
      
      if (response && response.data && response.data.data) {
        // Return the secret value - assuming single key-value pair
        const keys = Object.keys(response.data.data);
        if (keys.length > 0) {
          return response.data.data[keys[0]];
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to retrieve secret from Vault: ${secretName}`, error);
      return null;
    }
  }

  async updateSecret(secretName: string, secretValue: string): Promise<void> {
    if (!this.enabled) {
      throw new Error('Vault integration is not enabled');
    }

    try {
      const url = `${this.vaultUrl}/v1/${this.vaultPath}/${secretName}`;
      const payload = {
        data: {
          value: secretValue,
        },
      };

      await this.makeVaultRequest(url, 'POST', payload);
      this.logger.log(`Secret updated in Vault: ${secretName}`);
    } catch (error) {
      this.logger.error(`Failed to update secret in Vault: ${secretName}`, error);
      throw error;
    }
  }

  async rotateSecret(secretName: string): Promise<void> {
    if (!this.enabled) {
      throw new Error('Vault integration is not enabled');
    }

    this.logger.log(`Initiating rotation for secret in Vault: ${secretName}`);
    
    try {
      const newSecret = this.generateSecretValue();
      await this.updateSecret(secretName, newSecret);
      this.logger.log(`Secret rotated successfully in Vault: ${secretName}`);
    } catch (error) {
      this.logger.error(`Failed to rotate secret in Vault: ${secretName}`, error);
      throw error;
    }
  }

  private async makeVaultRequest(url: string, method: string, body?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: method,
        headers: {
          'X-Vault-Token': this.vaultToken,
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`Vault request failed: ${res.statusCode} - ${data}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  private generateSecretValue(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
