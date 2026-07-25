import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { NotificationType } from './notification.entity';

@Entity('notification_templates')
@Index(['name', 'templateVersion', 'channel'], { unique: true })
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column()
  name: string;

  @Column({ type: 'int', default: 1 })
  templateVersion: number;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.EMAIL,
  })
  channel: NotificationType;

  @Column({ nullable: true })
  subjectTemplate: string;

  @Column('text')
  bodyTemplate: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
