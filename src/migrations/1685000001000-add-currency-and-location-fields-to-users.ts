import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Migration: Add currency and location fields to users table
 * For supporting localized currency and pricing
 */
export class AddCurrencyAndLocationFieldsToUsers1685000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');

    if (!table) {
      return;
    }

    // Add country field
    if (!table.findColumnByName('country')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'country',
          type: 'varchar',
          isNullable: true,
        }),
      );
    }

    // Add countryCode field
    if (!table.findColumnByName('country_code')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'country_code',
          type: 'varchar',
          length: '2',
          isNullable: true,
        }),
      );
      // Add index
      await queryRunner.createIndex(
        'users',
        new TableIndex({
          columnNames: ['country_code'],
          name: 'IDX_users_country_code',
        }),
      );
    }

    // Add timezone field
    if (!table.findColumnByName('timezone')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'timezone',
          type: 'varchar',
          isNullable: true,
        }),
      );
    }

    // Add city field
    if (!table.findColumnByName('city')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'city',
          type: 'varchar',
          isNullable: true,
        }),
      );
    }

    // Add preferredCurrency field
    if (!table.findColumnByName('preferred_currency')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'preferred_currency',
          type: 'varchar',
          length: '3',
          default: "'USD'",
          isNullable: true,
        }),
      );
      // Add index
      await queryRunner.createIndex(
        'users',
        new TableIndex({
          columnNames: ['preferred_currency'],
          name: 'IDX_users_preferred_currency',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');

    if (!table) {
      return;
    }

    // Drop indices first
    const countryCodeIndex = table.indices.find((i) => i.name === 'IDX_users_country_code');
    if (countryCodeIndex) {
      await queryRunner.dropIndex('users', countryCodeIndex);
    }

    const preferredCurrencyIndex = table.indices.find(
      (i) => i.name === 'IDX_users_preferred_currency',
    );
    if (preferredCurrencyIndex) {
      await queryRunner.dropIndex('users', preferredCurrencyIndex);
    }

    // Drop columns
    if (table.findColumnByName('country')) {
      await queryRunner.dropColumn('users', 'country');
    }

    if (table.findColumnByName('country_code')) {
      await queryRunner.dropColumn('users', 'country_code');
    }

    if (table.findColumnByName('timezone')) {
      await queryRunner.dropColumn('users', 'timezone');
    }

    if (table.findColumnByName('city')) {
      await queryRunner.dropColumn('users', 'city');
    }

    if (table.findColumnByName('preferred_currency')) {
      await queryRunner.dropColumn('users', 'preferred_currency');
    }
  }
}
