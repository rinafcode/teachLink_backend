import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { CohortThread } from './cohort-thread.entity';

@Entity('cohort_comments')
export class CohortComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  threadId: string;

  @ManyToOne(() => CohortThread, (thread) => thread.comments, { onDelete: 'CASCADE' })
  thread: CohortThread;

  @Column()
  authorId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  parentId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
