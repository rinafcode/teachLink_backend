import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create the `event_outbox` table backing the transactional outbox
 * (issue #1221).
 *
 * Producers persist domain events in the same transaction as the state change
 * they describe; `OutboxRelayService` polls unpublished rows after commit and
 * dispatches them to the in-process EventEmitter2 bus, marking them published
 * only after a successful dispatch. The `(publishedAt, createdAt)` index
 * serves the relay's "unpublished, oldest first" query.
 *
 * The SQL below is exactly what TypeORM generates from the `OutboxEvent`
 * entity, so `migration:generate --check` (schema drift check) stays green.
 */
export class CreateEventOutbox1798000000000 implements MigrationInterface {
  name = 'CreateEventOutbox1798000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "event_outbox" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "eventName" character varying(255) NOT NULL, "payload" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "publishedAt" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT \'0\', CONSTRAINT "PK_c8bd4a6797caa3ebad9b40c9813" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_a74e4e8eecdd2907ea9fb355c1" ON "event_outbox" ("publishedAt", "createdAt") ',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_a74e4e8eecdd2907ea9fb355c1"');
    await queryRunner.query('DROP TABLE "event_outbox"');
  }
}
