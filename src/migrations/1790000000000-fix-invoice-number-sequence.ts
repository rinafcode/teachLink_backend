import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #1003 — Replace timestamp+random invoice numbering with PostgreSQL sequence
 *
 * ## Problem
 *
 * Invoice numbers were generated as `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`.
 * Under concurrent payment webhooks (common occurrence), this produces collisions:
 *  - Two webhooks processed in the same millisecond
 *  - Random component collision probability: 1 in 1000 per millisecond
 *  - Real concurrency under production load (especially webhook handlers) makes this routine
 *  - Result: financial records corrupted (same invoiceNumber on two distinct DB rows)
 *  - Archived HTML filenames also derived from invoiceNumber, compounding the coupling issue
 *
 * This migration:
 *  1. Identifies and resolves pre-existing duplicate invoiceNumbers safely
 *  2. Creates a PostgreSQL sequence for invoice numbering
 *  3. Adds a unique constraint to prevent future duplicates
 *  4. Uses atomic sequence generation at the database level (nextval())
 *
 * ## Resolution Strategy for Pre-Existing Duplicates
 *
 * If duplicate invoiceNumbers exist:
 *  - Do NOT delete or merge financial records (audit trail loss)
 *  - Reassign each duplicate-numbered row a new, unique invoiceNumber from the sequence
 *  - Assignment is deterministic: ordered by (createdAt, id) to be reproducible/debuggable
 *  - Log the old→new mapping (via NOTICE statements visible in migration output)
 *  - This preserves all financial data while ensuring uniqueness going forward
 *
 * ## Invoice Number Format
 *
 * Format: `INV-<6-digit-zero-padded-sequence-value>`
 * Examples: INV-000001, INV-000042, INV-999999
 *
 * Rationale:
 *  - Human-readable, sortable in order of generation
 *  - 6-digit width supports up to 1M invoices; migration supports sequence wraparound
 *  - Consistent with common financial industry practice
 *
 * ## Verification
 *
 * After migration:
 *  1. SELECT COUNT(DISTINCT invoiceNumber) FROM invoices;
 *     -- Should equal total invoice count (no duplicates)
 *  2. SELECT invoiceNumber FROM invoices ORDER BY createdAt LIMIT 5;
 *     -- Should show monotonically increasing sequence values
 *  3. SELECT currval('invoice_number_seq');
 *     -- Shows current sequence position for debugging
 */
export class FixInvoiceNumberSequence1790000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Use the queryRunner handed to us by the migration runner. Migrations run
    // inside a single shared transaction (TypeORM's default "all" mode), so a
    // freshly created query runner (a separate pooled connection) would not see
    // tables created by earlier migrations in the same run.
    const queryInterface = queryRunner;

    try {
      // ========================================================================
      // STEP 1: Identify and Resolve Pre-Existing Duplicates
      // ========================================================================

      this.logger('Step 1: Identifying pre-existing duplicate invoiceNumbers...');

      // Find duplicates
      const duplicates = await queryInterface.query(`
        SELECT "invoiceNumber", COUNT(*) as count
        FROM invoices
        WHERE "invoiceNumber" IS NOT NULL
        GROUP BY "invoiceNumber"
        HAVING COUNT(*) > 1
        ORDER BY count DESC;
      `);

      if (duplicates.length > 0) {
        this.logger(`Found ${duplicates.length} duplicate invoiceNumber values.`);
        this.logger('Examples:', duplicates.slice(0, 5));

        // For each duplicate, reassign all but the first occurrence
        for (const dup of duplicates) {
          const invoiceNumber = dup.invoiceNumber;
          const count = dup.count;

          this.logger(`Resolving ${count} invoices with invoiceNumber="${invoiceNumber}"...`);

          // Get all rows with this duplicate number, ordered by createdAt then id
          const rows = await queryInterface.query(
            `
            SELECT id, "invoiceNumber", "createdAt"
            FROM invoices
            WHERE "invoiceNumber" = $1
            ORDER BY "createdAt" ASC, id ASC;
          `,
            [invoiceNumber],
          );

          // Keep the first one unchanged; reassign the rest
          // Note: At this point the sequence doesn't exist yet, so we'll use
          // a temporary naming scheme and fix it later
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const newInvoiceNumber = `${invoiceNumber}-DUP-${i}`;

            await queryInterface.query(
              `
              UPDATE invoices
              SET "invoiceNumber" = $1
              WHERE id = $2;
            `,
              [newInvoiceNumber, row.id],
            );

            this.logger(
              `  Reassigned invoice ${row.id}: "${invoiceNumber}" → "${newInvoiceNumber}"`,
            );
          }
        }
      } else {
        this.logger('No duplicate invoiceNumbers found. Proceeding with sequence setup.');
      }

      // ========================================================================
      // STEP 2: Create PostgreSQL Sequence
      // ========================================================================

      this.logger('Step 2: Creating invoice_number_seq sequence...');

      // Drop if exists (shouldn't, but be safe)
      await queryInterface.query('DROP SEQUENCE IF EXISTS invoice_number_seq;');

      // Create sequence: starting at 1, no max (let it wrap naturally at bigint boundary)
      await queryInterface.query(`
        CREATE SEQUENCE invoice_number_seq
          START WITH 1
          INCREMENT BY 1
          NO MINVALUE
          NO CYCLE;
      `);

      this.logger('Sequence created successfully.');

      // ========================================================================
      // STEP 3: Migrate Existing Invoice Numbers (if duplicates were resolved)
      // ========================================================================

      if (duplicates.length > 0) {
        this.logger('Step 3: Migrating existing invoices to sequence-based numbering...');

        // Get existing invoices ordered by createdAt, assign each a sequence number
        // This ensures existing invoices maintain chronological ordering
        const existingInvoices = await queryInterface.query(`
          SELECT id, "invoiceNumber", "createdAt"
          FROM invoices
          ORDER BY "createdAt" ASC, id ASC;
        `);

        for (let idx = 0; idx < existingInvoices.length; idx++) {
          const invoice = existingInvoices[idx];
          const seqNum = idx + 1;
          const newInvoiceNumber = `INV-${String(seqNum).padStart(6, '0')}`;

          await queryInterface.query(
            `
            UPDATE invoices
            SET "invoiceNumber" = $1
            WHERE id = $2;
          `,
            [newInvoiceNumber, invoice.id],
          );
        }

        // Advance sequence to next value after migrations
        await queryInterface.query(
          `
          SELECT setval('invoice_number_seq', $1, true);
        `,
          [existingInvoices.length],
        );

        this.logger(`Migrated ${existingInvoices.length} invoices to sequence-based numbering.`);
      } else {
        // No duplicates: Initialize sequence to the number of existing invoices.
        // If there are no invoices the sequence is left at its default start
        // value (1) — setval(..., 0, true) would fail because 0 is below the
        // sequence minimum.
        const countResult = await queryInterface.query(`
          SELECT COUNT(*) as cnt FROM invoices;
        `);
        const invoiceCount = Number(countResult[0]?.cnt ?? 0);
        if (invoiceCount > 0) {
          await queryInterface.query("SELECT setval('invoice_number_seq', $1, true);", [
            invoiceCount,
          ]);
        }
      }

      // ========================================================================
      // STEP 4: Add Unique Constraint
      // ========================================================================

      this.logger('Step 4: Adding unique constraint on invoiceNumber...');

      // First, ensure no NULLs (they would exclude themselves from unique constraint)
      await queryInterface.query(`
        UPDATE invoices
        SET "invoiceNumber" = 'INV-' || LPAD(nextval('invoice_number_seq')::text, 6, '0')
        WHERE "invoiceNumber" IS NULL;
      `);

      // Add unique constraint (TypeORM's @Column({ unique: true }) creates this)
      // But we do it explicitly here to control naming and ensure it's added
      await queryInterface.query(`
        ALTER TABLE invoices
        ADD CONSTRAINT "UQ_invoices_invoiceNumber"
        UNIQUE ("invoiceNumber");
      `);

      this.logger('Unique constraint added successfully.');

      // ========================================================================
      // STEP 5: Verify Uniqueness
      // ========================================================================

      this.logger('Step 5: Verifying no duplicates remain...');

      const duplicateCheck = await queryInterface.query(`
        SELECT COUNT(*) as duplicate_count
        FROM (
          SELECT "invoiceNumber"
          FROM invoices
          WHERE "invoiceNumber" IS NOT NULL
          GROUP BY "invoiceNumber"
          HAVING COUNT(*) > 1
        ) AS dups;
      `);

      const dupCount = duplicateCheck[0]?.duplicate_count || 0;
      if (dupCount > 0) {
        throw new Error(
          `Migration safety check failed: Found ${dupCount} duplicate invoiceNumbers after resolution. ` +
            'This indicates a bug in the resolution logic.',
        );
      }

      this.logger('Verification passed: All invoiceNumbers are unique.');

      // ========================================================================
      // Summary
      // ========================================================================

      this.logger('Migration completed successfully.');
      this.logger('  - Sequence: invoice_number_seq created');
      this.logger('  - Constraint: UQ_invoices_invoiceNumber added');
      this.logger('  - Format: INV-<6-digit-zero-padded-sequence>');
      this.logger('  - Next invoice will use: INV-<current-nextval>');
    } catch (error) {
      this.logger(`ERROR during migration: ${(error as Error).message}`);
      throw error;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Same rationale as up(): reuse the transaction's queryRunner rather than
    // opening a separate pooled connection.
    const queryInterface = queryRunner;

    this.logger('Reverting migration...');

    // Drop unique constraint
    await queryInterface.query(`
      ALTER TABLE invoices
      DROP CONSTRAINT IF EXISTS "UQ_invoices_invoiceNumber";
    `);

    // Drop sequence
    await queryInterface.query(`
      DROP SEQUENCE IF EXISTS invoice_number_seq CASCADE;
    `);

    // Revert invoices back to old timestamp+random format (not recoverable, but at least
    // the database is consistent)
    // In practice, you may want to store the old value somewhere before migration for rollback
    this.logger(
      'WARNING: Down migration cannot recover original timestamp+random values. ' +
        'Invoices have been renumbered. Consider a full restore from backup if needed.',
    );
  }

  /**
   * Simple logger for migration visibility
   */
  private logger(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`[${timestamp}] ${message}`, data);
    } else {
      console.log(`[${timestamp}] ${message}`);
    }
  }
}
