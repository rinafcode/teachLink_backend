import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ForumThread } from './forum-thread.entity';

@Entity('forum_comments')
export class ForumComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  threadId: string;

  @ManyToOne(() => ForumThread, (thread) => thread.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'threadId' })
  thread: ForumThread;

  @Column({ nullable: true })
  parentId: string;

  @Column({ type: 'text' })
  content: string;

  @Column()
  authorId: string;

  @Column({ default: 'active' })
  status: string;

  @Column({ default: 0 })
  upvotes: number;

  @Column({ default: 0 })
  downvotes: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
