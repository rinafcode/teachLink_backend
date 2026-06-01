import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Represents archived data from various tables.
 * Data is stored as JSON for flexibility.
 */
@Entity('archived_data')
@Index(['entityType', 'originalId'])
export class ArchivedData {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  entityType: string;

  @Column()
  @Index()
  originalId: string;

  @Column('jsonb')
  data: any;

  @CreateDateColumn()
  @Index()
  archivedAt: Date;

  @Column({ nullable: true })
  tableName: string;
}
