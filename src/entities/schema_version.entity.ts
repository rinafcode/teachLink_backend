import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { SchemaChange } from './schema_change.entity';

@Entity('schema_version')
@Index('IDX_schema_version_schemaName', ['schemaName'])
@Index('IDX_schema_version_checksum', ['checksum'])
@Index('IDX_schema_version_createdAt', ['createdAt'])
@Index('IDX_schema_version_schemaName_createdAt', ['schemaName', 'createdAt'])
export class SchemaVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: '255' })
  schemaName: string;

  @Column({ type: 'jsonb' })
  definition: Record<string, any>;

  @Column({ type: 'varchar', length: '64' })
  checksum: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @OneToMany(() => SchemaChange, (change) => change.schemaVersion, { cascade: true })
  changes: SchemaChange[];
}
