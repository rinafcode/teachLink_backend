import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('badges')
export class Badge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  iconUrl: string;

  @Column()
  criteriaType: string; // e.g., 'POINTS_REACHED', 'CHALLENGE_COMPLETED'

  @Column('jsonb', { nullable: true })
  criteriaValue: any;
}
