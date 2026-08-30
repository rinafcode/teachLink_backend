import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPausedSubscriptionStatus1790000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'paused' to the subscription status enum type.
    //
    // TypeORM names enum types `<table>_<column>_enum`, so the type backing
    // `subscriptions.status` is `subscriptions_status_enum`. An older
    // production schema used the hand-written name `subscription_status`, so we
    // add the value to whichever of the two exists (and no-op when neither
    // does, e.g. fresh installs where the baseline already contains 'paused').
    await queryRunner.query(`
      DO $$
      DECLARE
        enum_type text;
      BEGIN
        SELECT typname INTO enum_type
        FROM pg_type
        WHERE typname IN ('subscriptions_status_enum', 'subscription_status')
        ORDER BY (typname = 'subscriptions_status_enum') DESC
        LIMIT 1;

        IF enum_type IS NOT NULL THEN
          EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS ''paused''', enum_type);
        END IF;
      END $$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values directly
    // To rollback, you would need to recreate the enum without the value
    // This is a limitation of PostgreSQL's enum type
    // For production, consider using a different approach for status management
    // such as a separate status table or string type with check constraints
    console.warn(
      'WARNING: [AddPausedSubscriptionStatus1790000000000] down() is a no-op. ' +
        'PostgreSQL does not support removing values from an enum type; "paused" remains in subscriptions_status_enum.',
    );
  }
}
