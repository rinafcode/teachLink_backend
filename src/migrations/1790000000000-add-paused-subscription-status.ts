import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPausedSubscriptionStatus1790000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'paused' to the subscription_status enum type
    await queryRunner.query(`
      ALTER TYPE "subscription_status" 
      ADD VALUE IF NOT EXISTS 'paused'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values directly
    // To rollback, you would need to recreate the enum without the value
    // This is a limitation of PostgreSQL's enum type
    // For production, consider using a different approach for status management
    // such as a separate status table or string type with check constraints
  }
}
