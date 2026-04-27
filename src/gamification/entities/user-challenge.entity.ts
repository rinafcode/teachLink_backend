import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, VersionColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Challenge } from './challenge.entity';

@Entity('user_challenges')
export class UserChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Challenge)
  challenge: Challenge;

  @Column({ default: 0 })
  progressValue: number;

  @Column({ default: false })
  isCompleted: boolean;

  @Column({ nullable: true })
  completedAt: Date;
}
