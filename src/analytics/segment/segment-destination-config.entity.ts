import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

Entity('segment_destination_configs')
@Index('IDX_SEG_DEST_CONFIG_ENABLED_UPDATED_AT', ['enabled', 'updatedAt'])
@Index('IDX_SEG_DEST_CONFIG_CREATED_AT', ['createdAt'])
export class SegmentDestinationConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
