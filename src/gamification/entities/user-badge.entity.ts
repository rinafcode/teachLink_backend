import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  VersionColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Badge } from './badge.entity';

/**
 * Represents the user Badge entity.
 */
@Entity('user_badges')
export class UserBadge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Badge)
  badge: Badge;

  @CreateDateColumn()
  earnedAt: Date;
}
