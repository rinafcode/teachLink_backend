import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableTenantRls1710000000000 implements MigrationInterface {
    name = 'EnableTenantRls1710000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE users FORCE ROW LEVEL SECURITY`({
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE users NO FORCE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE users DISABLE ROW LEVEL SECURITY`);
    }
}
