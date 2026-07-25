import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ForumComment } from './forum-comment.entity';

@Entity('forum_threads')
export class ForumThread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column()
  authorId: string;

  @Column({ default: 'active' })
  status: string; // 'active', 'flagged', 'hidden'

  @Column({ default: 0 })
  upvotes: number;

  @Column({ default: 0 })
  downvotes: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ForumComment, (comment) => comment.thread)
  comments: ForumComment[];
}
