import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAchievementsSchema1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create achievements table
    await queryRunner.createTable(
      new Table({
        name: 'achievements',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'version',
            type: 'integer',
            default: 0,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'longDescription',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'iconUrl',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['milestone', 'challenge', 'streaks', 'skill_based', 'engagement', 'contribution'],
            isNullable: false,
          },
          {
            name: 'difficulty',
            type: 'enum',
            enum: ['easy', 'medium', 'hard', 'legendary'],
            isNullable: false,
          },
          {
            name: 'pointsReward',
            type: 'integer',
            default: 0,
          },
          {
            name: 'experienceReward',
            type: 'integer',
            default: 0,
          },
          {
            name: 'criteria',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'progressConfig',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'isHidden',
            type: 'boolean',
            default: false,
          },
          {
            name: 'unlockedBy',
            type: 'integer',
            default: 0,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    // Create achievement_progress table
    await queryRunner.createTable(
      new Table({
        name: 'achievement_progress',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'version',
            type: 'integer',
            default: 0,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'achievementId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'currentProgress',
            type: 'integer',
            default: 0,
          },
          {
            name: 'targetProgress',
            type: 'integer',
            default: 0,
          },
          {
            name: 'percentageComplete',
            type: 'integer',
            default: 0,
          },
          {
            name: 'isUnlocked',
            type: 'boolean',
            default: false,
          },
          {
            name: 'lastProgressUpdate',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['achievementId'],
            referencedTableName: 'achievements',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // Create user_achievements table
    await queryRunner.createTable(
      new Table({
        name: 'user_achievements',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'version',
            type: 'integer',
            default: 0,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'achievementId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'unlockedAt',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'unlockedMetadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'pointsEarned',
            type: 'integer',
            default: 0,
          },
          {
            name: 'experienceEarned',
            type: 'integer',
            default: 0,
          },
          {
            name: 'notificationSent',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isHidden',
            type: 'boolean',
            default: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['achievementId'],
            referencedTableName: 'achievements',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // Create achievement_statistics table
    await queryRunner.createTable(
      new Table({
        name: 'achievement_statistics',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'version',
            type: 'integer',
            default: 0,
          },
          {
            name: 'achievementId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'date',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'totalUnlocked',
            type: 'integer',
            default: 0,
          },
          {
            name: 'unlockedToday',
            type: 'integer',
            default: 0,
          },
          {
            name: 'unlockedPercentage',
            type: 'numeric',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'averageTimeToUnlock',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'activeTrackers',
            type: 'integer',
            default: 0,
          },
          {
            name: 'averageProgress',
            type: 'numeric',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'engagementTrend',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['achievementId'],
            referencedTableName: 'achievements',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'achievement_progress',
      new TableIndex({
        name: 'IDX_achievement_progress_user_achievement',
        columnNames: ['userId', 'achievementId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'achievement_progress',
      new TableIndex({
        name: 'IDX_achievement_progress_user',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'achievement_progress',
      new TableIndex({
        name: 'IDX_achievement_progress_achievement',
        columnNames: ['achievementId'],
      }),
    );

    await queryRunner.createIndex(
      'achievement_progress',
      new TableIndex({
        name: 'IDX_achievement_progress_unlocked',
        columnNames: ['isUnlocked'],
      }),
    );

    await queryRunner.createIndex(
      'user_achievements',
      new TableIndex({
        name: 'IDX_user_achievements_user_achievement',
        columnNames: ['userId', 'achievementId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'user_achievements',
      new TableIndex({
        name: 'IDX_user_achievements_user',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'user_achievements',
      new TableIndex({
        name: 'IDX_user_achievements_achievement',
        columnNames: ['achievementId'],
      }),
    );

    await queryRunner.createIndex(
      'user_achievements',
      new TableIndex({
        name: 'IDX_user_achievements_unlocked_at',
        columnNames: ['unlockedAt'],
      }),
    );

    await queryRunner.createIndex(
      'achievement_statistics',
      new TableIndex({
        name: 'IDX_achievement_statistics_achievement_date',
        columnNames: ['achievementId', 'date'],
      }),
    );

    await queryRunner.createIndex(
      'achievement_statistics',
      new TableIndex({
        name: 'IDX_achievement_statistics_date',
        columnNames: ['date'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('achievement_statistics');
    await queryRunner.dropTable('user_achievements');
    await queryRunner.dropTable('achievement_progress');
    await queryRunner.dropTable('achievements');
  }
}
