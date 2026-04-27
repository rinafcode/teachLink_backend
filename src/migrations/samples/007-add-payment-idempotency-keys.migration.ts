import { Injectable, Logger } from '@nestjs/common';
import { IMigrationConfig } from '../migration.service';

/**
 * Migration 007 — Add idempotency_key columns to payments and refunds
 *
 * up:   Adds a nullable, unique-indexed `idempotency_key` column to both the
 *       `payments` and `refunds` tables. Existing rows receive NULL, which the
 *       UNIQUE constraint allows for multiple rows (NULL ≠ NULL in SQL).
 *
 * down: Removes the columns and their associated indexes.
 */
@Injectable()
export class AddPaymentIdempotencyKeysMigration implements IMigrationConfig {
  name = '007-add-payment-idempotency-keys';
  version = '1.0.0';
  dependencies: string[] = [];

  private readonly logger = new Logger(AddPaymentIdempotencyKeysMigration.name);

  async up(connection: any): Promise<void> {
    this.logger.log('Applying migration: add idempotency_key to payments and refunds');

    await connection.query(`
      ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR UNIQUE;
    `);

    await connection.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key
        ON payments (idempotency_key)
        WHERE idempotency_key IS NOT NULL;
    `);

    await connection.query(`
      ALTER TABLE refunds
        ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR UNIQUE;
    `);

    await connection.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_idempotency_key
        ON refunds (idempotency_key)
        WHERE idempotency_key IS NOT NULL;
    `);

    this.logger.log('Migration applied: idempotency_key columns added');
  }

  async down(connection: any): Promise<void> {
    this.logger.log('Rolling back migration: remove idempotency_key from payments and refunds');

    await connection.query('DROP INDEX IF EXISTS idx_payments_idempotency_key;');
    await connection.query('ALTER TABLE payments DROP COLUMN IF EXISTS idempotency_key;');

    await connection.query('DROP INDEX IF EXISTS idx_refunds_idempotency_key;');
    await connection.query('ALTER TABLE refunds DROP COLUMN IF EXISTS idempotency_key;');

    this.logger.log('Migration rolled back: idempotency_key columns removed');
  }
}
