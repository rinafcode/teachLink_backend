import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('point_transactions')
export class PointTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  points: number;

  @Column()
  activityType: string; // e.g., 'COURSE_COMPLETED', 'DAILY_LOGIN'

  @CreateDateColumn()
  createdAt: Date;
}
