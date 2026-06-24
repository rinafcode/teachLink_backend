import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { Cohort } from './cohort.entity';
import { CohortComment } from './cohort-comment.entity';

@Entity('cohort_threads')
export class CohortThread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  cohortId: string;

  @ManyToOne(() => Cohort, (cohort) => cohort.threads, { onDelete: 'CASCADE' })
  cohort: Cohort;

  @Column()
  authorId: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @OneToMany(() => CohortComment, (comment) => comment.thread)
  comments: CohortComment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
