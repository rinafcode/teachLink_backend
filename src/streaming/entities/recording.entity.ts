import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Room } from './room.entity';
import { User } from './user.entity';

export enum RecordingStatus {
  STARTING = 'starting',
  RECORDING = 'recording',
  STOPPING = 'stopping',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PROCESSING = 'processing',
  READY = 'ready',
}

@Entity('streaming_recordings')
export class Recording {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({
    type: 'enum',
    enum: RecordingStatus,
    default: RecordingStatus.STARTING,
  })
  status: RecordingStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  filePath: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  downloadUrl: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize: number;

  @Column({ type: 'integer', nullable: true })
  duration: number; // in seconds

  @Column({ type: 'varchar', length: 50, default: 'mp4' })
  format: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  resolution: string;

  @Column({ type: 'integer', nullable: true })
  bitrate: number;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ type: 'text', nullable: true })
  processingLog: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  isPublic: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Room, (room) => room.recordings)
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @Column({ type: 'uuid' })
  roomId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'startedById' })
  startedBy: User;

  @Column({ type: 'uuid' })
  startedById: string;
}
