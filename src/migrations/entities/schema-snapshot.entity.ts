import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('schema_snapshots')
@Index(['environment', 'version'])
@Index(['timestamp'])
export class SchemaSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  version: string;

  @Column()
  environment: string;

  @Column({ type: 'jsonb' })
  schema: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      default?: any;
    }>;
    indexes: Array<{
      name: string;
      columns: string[];
      unique: boolean;
    }>;
    constraints: Array<{
      name: string;
      type: string;
      definition: string;
    }>;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  views: Array<{
    name: string;
    definition: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  procedures: Array<{
    name: string;
    definition: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  functions: Array<{
    name: string;
    definition: string;
  }>;

  @Column()
  checksum: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', name: 'timestamp' })
  @Index()
  timestamp: Date;
}
