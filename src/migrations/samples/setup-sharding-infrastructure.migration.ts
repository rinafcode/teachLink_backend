import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Setup Database Sharding Infrastructure
 *
 * Creates necessary tables and metadata for database sharding
 */
export class SetupShardingInfrastructure1700000000000 implements MigrationInterface {
  name = 'SetupShardingInfrastructure1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Create shard_mappings table - tracks which data lives on which shard
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shard_mappings (
        id SERIAL PRIMARY KEY,
        shard_key VARCHAR(255) NOT NULL,
        shard_id VARCHAR(50) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(shard_key, entity_type, entity_id)
      )
    `);

    // Create shard_health table - tracks shard health status
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shard_health (
        id SERIAL PRIMARY KEY,
        shard_id VARCHAR(50) NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        latency_ms INTEGER,
        active_connections INTEGER,
        total_connections INTEGER,
        disk_usage_bytes BIGINT,
        row_count INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create shard_transactions table - tracks cross-shard transactions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shard_transactions (
        id VARCHAR(50) PRIMARY KEY,
        transaction_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        involved_shards JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        metadata JSONB
      )
    `);

    // Create shard_rebalancing_log table - tracks rebalancing operations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shard_rebalancing_log (
        id SERIAL PRIMARY KEY,
        source_shard VARCHAR(50) NOT NULL,
        target_shard VARCHAR(50) NOT NULL,
        table_name VARCHAR(100) NOT NULL,
        rows_moved INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX idx_shard_mappings_shard_key ON shard_mappings(shard_key)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_shard_mappings_entity ON shard_mappings(entity_type, entity_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_shard_health_status ON shard_health(status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_shard_transactions_status ON shard_transactions(status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_shard_rebalancing_log_date ON shard_rebalancing_log(started_at)
    `);

    // Insert initial shard metadata
    await queryRunner.query(`
      INSERT INTO shard_health (shard_id, status, last_check)
      VALUES 
        ('shard_00', 'active', NOW()),
        ('shard_01', 'active', NOW()),
        ('shard_02', 'active', NOW())
      ON CONFLICT (shard_id) DO NOTHING
    `);

    console.log('Sharding infrastructure tables created successfully');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS shard_rebalancing_log');
    await queryRunner.query('DROP TABLE IF EXISTS shard_transactions');
    await queryRunner.query('DROP TABLE IF EXISTS shard_health');
    await queryRunner.query('DROP TABLE IF EXISTS shard_mappings');
  }
}
