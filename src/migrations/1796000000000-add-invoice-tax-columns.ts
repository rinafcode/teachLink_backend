import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds the tax bookkeeping columns to `invoices`:
 *  - `taxRate`          — the applied rate as a decimal fraction (e.g. 0.19)
 *  - `taxJurisdiction`  — the ISO 3166-1 country code / region the rate was
 *                         resolved from (audit trail)
 *
 * Existing invoices keep `taxAmount = 0` / `totalAmount = amount`, so this is
 * a purely additive, non-destructive change.
 */
export class AddInvoiceTaxColumns1796000000000 implements MigrationInterface {
  name = 'AddInvoiceTaxColumns1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('invoices');

    if (!table) {
      return;
    }

    if (!table.findColumnByName('taxRate')) {
      await queryRunner.addColumn(
        table,
        new TableColumn({
          name: 'taxRate',
          type: 'numeric',
          precision: 5,
          scale: 4,
          isNullable: true,
        }),
      );
    }

    if (!table.findColumnByName('taxJurisdiction')) {
      await queryRunner.addColumn(
        table,
        new TableColumn({
          name: 'taxJurisdiction',
          type: 'varchar',
          length: '64',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('invoices');

    if (!table) {
      return;
    }

    if (table.findColumnByName('taxJurisdiction')) {
      await queryRunner.dropColumn(table, 'taxJurisdiction');
    }

    if (table.findColumnByName('taxRate')) {
      await queryRunner.dropColumn(table, 'taxRate');
    }
  }
}
