import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Represents the point Transaction entity.
 */
@Entity('point_transactions')
@Index('IDX_point_transactions_user_createdAt', ['user', 'createdAt'])
@Index('IDX_point_transactions_activityType', ['activityType'])
export class PointTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @ManyToOne(() => User)
  user: User;

  @Column()
  points: number;

  @Column()
  activityType: string; // e.g., 'COURSE_COMPLETED', 'DAILY_LOGIN'

  @CreateDateColumn()
  createdAt: Date;
}
