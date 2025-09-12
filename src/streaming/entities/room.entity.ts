import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { Participant } from './participant.entity';
import { Recording } from './recording.entity';

export enum RoomStatus {
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  LIVE = 'live',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}

@Entity('streaming_rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: RoomStatus,
    default: RoomStatus.SCHEDULED,
  })
  status: RoomStatus;

  @Column({ type: 'integer', default: 50 })
  maxParticipants: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  roomCode: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string;

  @Column({ type: 'boolean', default: false })
  isRecording: boolean;

  @Column({ type: 'boolean', default: true })
  allowChat: boolean;

  @Column({ type: 'boolean', default: false })
  allowScreenShare: boolean;

  @Column({ type: 'boolean', default: false })
  requireModeratorApproval: boolean;

  @Column({ type: 'timestamp', nullable: true })
  scheduledStartTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  scheduledEndTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualStartTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualEndTime: Date;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  streamKey: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  rtmpUrl: string;

  @Column({ type: 'uuid', nullable: true })
  instructorId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'hostId' })
  host: User;

  @Column({ type: 'uuid' })
  hostId: string;

  @OneToMany(() => Participant, (participant) => participant.room)
  participants: Participant[];

  @OneToMany(() => Recording, (recording) => recording.room)
  recordings: Recording[];
}
