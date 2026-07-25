import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Tier } from '../enums/tier.enum';

/**
 * Represents the user Progress entity.
 */
@Entity('user_progress')
export class UserProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @OneToOne(() => User)
  @JoinColumn()
  @Index()
  user: User;

  @Column({ default: 0 })
  @Index()
  totalPoints: number;

  @Column({ default: 1 })
  @Index()
  level: number;

  @Column({ default: 0 })
  @Index()
  xp: number;

  @Column({ type: 'enum', enum: Tier, default: Tier.BRONZE })
  @Index()
  tier: Tier;
}
