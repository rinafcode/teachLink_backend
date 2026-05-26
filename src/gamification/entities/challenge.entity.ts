import { Entity, PrimaryGeneratedColumn, Column, VersionColumn } from 'typeorm';

/**
 * Represents the challenge entity.
 */
@Entity('challenges')
export class Challenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

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
