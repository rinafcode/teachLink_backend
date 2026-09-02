import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #990 — every forum write handler computed
 * `authorId = req.user?.id || 'anonymous'` with no guard on the controller,
 * so every thread, comment, and vote was written with the literal string
 * `'anonymous'` as its author. Two consequences:
 *
 *  1. `forum_vote` looked up existing votes by
 *     `(entityType, entityId, authorId)` — every anonymous voter collided on
 *     the single `'anonymous'` row, so vote tallies for any thread/comment
 *     that received more than one anonymous vote are meaningless (each new
 *     "anonymous" vote just flipped the same row).
 *  2. `forum_thread`/`forum_comment` content became unattributable, so the
 *     moderation queue (keyed on `sourceId`) has no author to act against.
 *
 * This migration:
 *  - Purges `forum_votes` rows whose `authorId` isn't a real user id — the
 *    literal `'anonymous'` plus any other non-UUID placeholder — since their
 *    tallies cannot be reconstructed (we don't know how many distinct
 *    anonymous callers voted, only that they collapsed into one row), then
 *    recomputes `upvotes`/`downvotes` on the affected threads/comments from
 *    what remains.
 *  - Flags `forum_thread`/`forum_comment` rows with `authorId = 'anonymous'`
 *    (status -> 'flagged') instead of deleting them outright, routing them
 *    through the same manual-review path flagged content already uses,
 *    since the content itself may still have value even though it can't be
 *    attributed.
 *  - Converts `forum_votes.authorId` from `varchar` to `uuid` (matching
 *    `users.id`) and adds a foreign key so a synthetic value can never be
 *    written again.
 *
 * **Irreversible parts** — `down()` cannot reconstruct:
 *  - Deleted anonymous vote rows (we don't know how many distinct callers
 *    voted, only that they collapsed into one row per entityType/entityId).
 *  - The `status = 'flagged'` update on threads/comments (we can't distinguish
 *    rows flagged by this migration from rows flagged by auto-moderation).
 *
 * **FK constraint name** — `down()` resolves the FK dynamically via
 * `pg_constraint` instead of using a hard-coded name, because the constraint
 * may have a TypeORM-generated hex-hash name (e.g. on dev with
 * `synchronize: true` or after `1796000000001-reconcile-schema-drift`).
 */
export class FixForumAnonymousAuthor1791000000001 implements MigrationInterface {
  private static readonly NOT_A_USER_ID =
    '"authorId" !~ \'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$\'';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Purge votes whose author isn't a real (UUID) user id and recompute
    //    affected tallies. This also catches any other synthetic placeholder
    //    that isn't a valid UUID, not just the literal 'anonymous' value —
    //    both would otherwise block the FK/type change below.
    const affected: Array<{ entityType: string; entityId: string }> = await queryRunner.query(`
      SELECT DISTINCT "entityType", "entityId" FROM forum_votes
      WHERE ${FixForumAnonymousAuthor1791000000001.NOT_A_USER_ID}
    `);

    await queryRunner.query(
      `DELETE FROM forum_votes WHERE ${FixForumAnonymousAuthor1791000000001.NOT_A_USER_ID}`,
    );

    for (const { entityType, entityId } of affected) {
      const [{ upvotes }] = await queryRunner.query(
        'SELECT COUNT(*)::int AS upvotes FROM forum_votes WHERE "entityType" = $1 AND "entityId" = $2 AND value = 1',
        [entityType, entityId],
      );
      const [{ downvotes }] = await queryRunner.query(
        'SELECT COUNT(*)::int AS downvotes FROM forum_votes WHERE "entityType" = $1 AND "entityId" = $2 AND value = -1',
        [entityType, entityId],
      );

      const table = entityType === 'thread' ? 'forum_threads' : 'forum_comments';
      await queryRunner.query(`UPDATE ${table} SET upvotes = $1, downvotes = $2 WHERE id = $3`, [
        upvotes,
        downvotes,
        entityId,
      ]);
    }

    // 2. Route unattributable content to manual review instead of deleting it.
    await queryRunner.query(
      "UPDATE forum_threads SET status = 'flagged' WHERE \"authorId\" = 'anonymous' AND status = 'active'",
    );
    await queryRunner.query(
      "UPDATE forum_comments SET status = 'flagged' WHERE \"authorId\" = 'anonymous' AND status = 'active'",
    );

    // 3. Align the column type with users.id and prevent a synthetic author
    //    id from ever being written again.
    await queryRunner.query(`
      ALTER TABLE forum_votes ALTER COLUMN "authorId" TYPE uuid USING "authorId"::uuid
    `);
    await queryRunner.query(`
      ALTER TABLE forum_votes
      ADD CONSTRAINT "FK_forum_votes_authorId_users"
      FOREIGN KEY ("authorId") REFERENCES users(id) ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Resolve the FK dynamically — the constraint may have a hard-coded name
    // (FK_forum_votes_authorId_users) or a TypeORM-generated hex-hash name
    // (e.g. FK_930875619d15f219f30923b724c), depending on environment.
    const fkRow: { conname: string } | undefined = await queryRunner.query(`
      SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class c ON c.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = c.relnamespace
       WHERE con.contype = 'f'
         AND c.relname = 'forum_votes'
         AND pg_get_constraintdef(con.oid, true) ILIKE '%("authorId")%users%'
       LIMIT 1
    `);
    if (fkRow) {
      await queryRunner.query(`ALTER TABLE forum_votes DROP CONSTRAINT ${fkRow.conname}`);
    }

    await queryRunner.query(`
      ALTER TABLE forum_votes ALTER COLUMN "authorId" TYPE varchar USING "authorId"::varchar
    `);
    // Irreversible: purged anonymous votes and flagged->active status changes
    // on threads/comments cannot be reconstructed (see class JSDoc).
  }
}
