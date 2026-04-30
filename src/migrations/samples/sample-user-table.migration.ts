import { Injectable, Logger } from '@nestjs/common';
import { IMigrationConfig } from '../migration.service';

/**
 * Provides sample User Table Migration behavior.
 */
@Injectable()
export class SampleUserTableMigration implements IMigrationConfig {
  name = 'sample-user-table';
  version = '1.0.0';
  dependencies = []; // List any dependencies this migration has

  private readonly logger = new Logger(SampleUserTableMigration.name);

  /**
   * Executes up.
   * @param _connection The connection.
   */
  async up(_connection: any): Promise<void> {
    this.logger.log('Applying sample user table migration');

    // In a real implementation, you would use the connection to execute SQL
    // For example with TypeORM:
    /*
    await connection.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    */

    // Mock implementation for demonstration
    console.log('Creating users table...');
  }

  /**
   * Executes down.
   * @param _connection The connection.
   */
  async down(_connection: any): Promise<void> {
    this.logger.log('Rolling back sample user table migration');

    // In a real implementation, you would revert the changes
    /*
    await connection.query(`DROP TABLE IF EXISTS users;`);
    */

    // Mock implementation for demonstration
    console.log('Dropping users table...');
  }
}
