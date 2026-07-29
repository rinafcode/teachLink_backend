import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add unique composite index on ForumVote(entityType, entityId, authorId)
 *
 * ## Context
 *
 * The `ForumService.vote()` method previously used a read-then-write pattern:
 * read the existing vote, then insert or update. Without a database-enforced
 * unique constraint, two concurrent requests from the same user could both
 * observe no existing row and both insert, permanently double-counting that
 * user's vote.
 *
 * ## Design Notes
 *
 * ### Unique composite index on (entityType, entityId, authorId)
 * - Enforces at most one vote per user per entity at the database level.
 * - Eliminates the race condition in `vote()`: concurrent requests now
 *   serialize on the unique index and the database resolves conflicts via
 *   `ON CONFLICT ... DO UPDATE`.
 * - The `@Unique(['entityType', 'entityId', 'authorId'])` decorator on the
 *   entity defines the constraint for TypeORM schema generation, but an
 *   explicit migration is required to create it when migrations are used
 *   instead of schema synchronization.
 */

export class AddForumVoteUniqueIndex1795000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_forum_votes_entityType_entityId_authorId"
        ON forum_votes ("entityType", "entityId", "authorId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_forum_votes_entityType_entityId_authorId"');
  }
}
