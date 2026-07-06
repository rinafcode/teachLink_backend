import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Cohort } from './cohort.entity';

@Entity('cohort_members')
export class CohortMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  cohortId: string;

  @ManyToOne(() => Cohort, (cohort) => cohort.members, { onDelete: 'CASCADE' })
  cohort: Cohort;

  @Column()
  @Index()
  userId: string;

  @Column({ default: 'member' })
  role: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
