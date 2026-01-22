import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('challenges')
export class Challenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column()
  rewardPoints: number;

  @Column()
  goalValue: number;

  @Column()
  type: string; // e.g., 'READ_ARTICLES', 'WATCH_VIDEOS'
}
