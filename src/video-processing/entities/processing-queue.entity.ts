import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum QueueStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  MAINTENANCE = 'maintenance',
}

@Entity('processing_queues')
@Index(['name'], { unique: true })
@Index(['status', 'priority'])
export class ProcessingQueue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: QueueStatus,
    default: QueueStatus.ACTIVE,
  })
  status: QueueStatus;

  @Column({ type: 'int', default: 5 })
  priority: number;

  @Column({ type: 'int', default: 10 })
  maxConcurrentJobs: number;

  @Column({ type: 'int', default: 0 })
  currentActiveJobs: number;

  @Column({ type: 'json', nullable: true })
  configuration: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  statistics: {
    totalProcessed?: number;
    totalFailed?: number;
    averageProcessingTime?: number;
    lastProcessedAt?: Date;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
