import { Injectable } from '@nestjs/common';
import { Connection, createConnection, getConnection } from 'typeorm';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TestDatabaseService {
  private connection: Connection;
  private isTestDb = false;

  async setup(): Promise<void> {
    try {
      // Try to get existing connection first
      this.connection = getConnection();
    } catch {
      // Create test connection if none exists
      this.connection = await createConnection({
        type: 'postgres',
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        username: process.env.DATABASE_USER || 'postgres',
        password: process.env.DATABASE_PASSWORD || 'password',
        database: process.env.DATABASE_NAME || 'teachlink_test',
        entities: ['src/**/*.entity{.ts,.js}'],
        synchronize: true, // Only for tests
        dropSchema: true, // Clean slate for each test run
        logging: false,
      });
      this.isTestDb = true;
    }
  }

  async teardown(): Promise<void> {
    if (this.isTestDb && this.connection) {
      await this.connection.close();
    }
  }

  async clean(): Promise<void> {
    if (this.connection && this.isTestDb) {
      // Clear all tables in reverse dependency order
      const entities = this.connection.entityMetadatas;
      for (const entity of entities.reverse()) {
        const repository = this.connection.getRepository(entity.name);
        await repository.clear();
      }
    }
  }

  getConnection(): Connection {
    return this.connection;
  }

  async waitForConnection(maxAttempts = 10, delayMs = 1000): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.connection.query('SELECT 1');
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error(
            `Database connection failed after ${maxAttempts} attempts: ${error.message}`,
          );
        }
        await this.delay(delayMs);
      }
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
