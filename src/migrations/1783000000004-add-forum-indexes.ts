import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add database indexes for forum queries
 *
 * ## Context
 *
 * The forum module contains four primary query patterns that were running
 * as sequential scans on every request:
 *
 * 1. **`ForumService.getThreads()`** — Filters on `status` and orders by `createdAt`:
 *    ```ts
 *    this.threadRepo.find({ where: { status: 'active' }, order: { createdAt: 'DESC' } })
 *    ```
 *
 * 2. **`ForumService.getThread(id)`** — Loads comments by `threadId`:
 *    ```ts
 *    this.threadRepo.findOne({ where: { id, status: 'active' }, relations: ['comments'] })
 *    ```
 *    The relation load triggers:
 *    ```sql
 *    SELECT * FROM forum_comments WHERE threadId = $1 ORDER BY createdAt
 *    ```
 *
 * 3. **`ForumService.vote()`** — Looks up existing votes by `(entityType, entityId, authorId)`:
 *    ```ts
 *    this.voteRepo.findOne({ where: { entityType, entityId, authorId } })
 *    ```
 *    This is already covered by the `@Unique(['entityType', 'entityId', 'authorId'])`
 *    constraint, which creates an implicit unique index.
 *
 * 4. **`ForumService.updateVoteTotals()`** — Counts votes by `(entityType, entityId, value)`:
 *    ```ts
 *    this.voteRepo.count({ where: { entityType, entityId, value: 1 } })
 *    this.voteRepo.count({ where: { entityType, entityId, value: -1 } })
 *    ```
 *
 * None of these queries had supporting indexes, causing full table scans.
 *
 * ## Design Notes
 *
 * ### ForumThread: `@Index(['status', 'createdAt'])`
 * - Composite index for the `getThreads()` query which filters on `status` and
 *   orders by `createdAt DESC`.
 * - PostgreSQL can use this index for both the WHERE clause and the ORDER BY.
 * - The index is ordered `(status, createdAt)` because the filter is on `status`
 *   first, then results are sorted by `createdAt`.
 *
 * ### ForumComment: `@Index(['threadId', 'createdAt'])`
 * - Composite index for loading comments by thread, ordered by creation time.
 * - Supports the implicit query triggered by `relations: ['comments']` in
 *   `getThread()`.
 * - The default ordering for comment display is chronological (oldest first),
 *   which this index supports efficiently.
 *
 * ### ForumComment: `@Index(['parentId'])`
 * - Single-column index for nested comment queries.
 * - Allows efficient loading of comment replies (comments where `parentId` is set).
 * - While not used in the current service methods, this is a common access pattern
 *   for threaded discussions and prevents future sequential scans.
 *
 * ### ForumVote: `@Index(['entityType', 'entityId'])`
 * - Composite index for the `updateVoteTotals()` query which counts votes by
 *   entity type and entity ID.
 * - The existing unique constraint `['entityType', 'entityId', 'authorId']` is
 *   useful for vote lookups but is not optimal for counting all votes on an entity.
 * - PostgreSQL can use a prefix of a composite index, so this `(entityType, entityId)`
 *   index supports both:
 *   - `WHERE entityType = $1 AND entityId = $2` (for counting all votes)
 *   - `WHERE entityType = $1 AND entityId = $2 AND value = $3` (for counting upvotes/downvotes)
 *
 * ## Verification
 *
 * After applying this migration, run the following queries to verify index usage:
 *
 * ### 1. getThreads() query:
 * ```sql
 * EXPLAIN ANALYZE
 *   SELECT * FROM forum_threads
 *    WHERE status = 'active'
 *    ORDER BY "createdAt" DESC;
 * ```
 * Expected: `Index Scan using IDX_forum_threads_status_createdAt`
 *
 * ### 2. getThread() comments relation:
 * ```sql
 * EXPLAIN ANALYZE
 *   SELECT * FROM forum_comments
 *    WHERE "threadId" = '<some-uuid>'
 *    ORDER BY "createdAt" ASC;
 * ```
 * Expected: `Index Scan using IDX_forum_comments_threadId_createdAt`
 *
 * ### 3. vote lookup (already indexed via unique constraint):
 * ```sql
 * EXPLAIN ANALYZE
 *   SELECT * FROM forum_votes
 *    WHERE "entityType" = 'thread'
 *      AND "entityId" = '<some-uuid>'
 *      AND "authorId" = '<some-uuid>';
 * ```
 * Expected: `Index Scan using UQ_... ` (unique constraint index)
 *
 * ### 4. updateVoteTotals() count query:
 * ```sql
 * EXPLAIN ANALYZE
 *   SELECT COUNT(*) FROM forum_votes
 *    WHERE "entityType" = 'thread'
 *      AND "entityId" = '<some-uuid>'
 *      AND value = 1;
 * ```
 * Expected: `Index Only Scan using IDX_forum_votes_entityType_entityId`
 *
 * Before this migration, all queries would show `Seq Scan on forum_*` indicating
 * full table scans.
 */
export class AddForumIndexes1783000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ForumThread: Support filtering by status and ordering by createdAt
    await queryRunner.query(`
      CREATE INDEX "IDX_forum_threads_status_createdAt"
        ON forum_threads (status, "createdAt")
    `);

    // ForumComment: Support loading comments by thread, ordered chronologically
    await queryRunner.query(`
      CREATE INDEX "IDX_forum_comments_threadId_createdAt"
        ON forum_comments ("threadId", "createdAt")
    `);

    // ForumComment: Support loading nested replies by parent comment
    await queryRunner.query(`
      CREATE INDEX "IDX_forum_comments_parentId"
        ON forum_comments ("parentId")
    `);

    // ForumVote: Support counting votes by entity (thread or comment)
    await queryRunner.query(`
      CREATE INDEX "IDX_forum_votes_entityType_entityId"
        ON forum_votes ("entityType", "entityId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_forum_threads_status_createdAt"');
    await queryRunner.query('DROP INDEX "IDX_forum_comments_threadId_createdAt"');
    await queryRunner.query('DROP INDEX "IDX_forum_comments_parentId"');
    await queryRunner.query('DROP INDEX "IDX_forum_votes_entityType_entityId"');
  }
}
