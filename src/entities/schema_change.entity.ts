import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { SchemaVersion } from './schema_version.entity';

export enum ChangeType {
  ADD_COLUMN = 'ADD_COLUMN',
  DROP_COLUMN = 'DROP_COLUMN',
  MODIFY_COLUMN = 'MODIFY_COLUMN',
  ADD_INDEX = 'ADD_INDEX',
  DROP_INDEX = 'DROP_INDEX',
  ADD_TABLE = 'ADD_TABLE',
  DROP_TABLE = 'DROP_TABLE',
  ADD_RELATION = 'ADD_RELATION',
  DROP_RELATION = 'DROP_RELATION',
}

@Entity('schema_change')
@Index('IDX_schema_change_schema_name_created_at', ['schemaName', 'createdAt'])
@Index('IDX_schema_change_schema_version_created_at', ['schemaVersion', 'createdAt'])
@Index('IDX_schema_change_change_type', ['changeType'])
export class SchemaChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: '255' })
  schemaName: string;

  @Column({ type: 'varchar', length: '50' })
  fromVersion: string;

  @Column({ type: 'varchar', length: '50' })
  toVersion: string;

  @Column({ type: 'enum', enum: ChangeType })
  changeType: ChangeType;

  @Column({ type: 'varchar', length: '255' })
  fieldPath: string;

  @Column({ type: 'jsonb', nullable: true })
  previousValue?: any;

  @Column({ type: 'jsonb', nullable: true })
  newValue?: any;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @ManyToOne(() => SchemaVersion, (sv) => sv.changes, { onDelete: 'CASCADE', nullable: false })
  schemaVersion: SchemaVersion;
}
