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

export enum AnnotationType {
  DRAW = 'draw',
  TEXT = 'text',
  SHAPE = 'shape',
  ARROW = 'arrow',
  HIGHLIGHT = 'highlight',
  ERASE = 'erase',
}

@Entity('streaming_whiteboard_annotations')
export class WhiteboardAnnotation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AnnotationType,
    default: AnnotationType.DRAW,
  })
  type: AnnotationType;

  @Column({ type: 'jsonb' })
  data: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    color?: string;
    thickness?: number;
    points?: number[];
    text?: string;
    [key: string]: any;
  };

  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'boolean', default: true })
  isVisible: boolean;

  @Column({ type: 'integer', default: 0 })
  layer: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @Column({ type: 'uuid' })
  roomId: string;
}
