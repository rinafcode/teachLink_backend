import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('forum_votes')
@Unique(['entityType', 'entityId', 'authorId'])
@Index('IDX_forum_votes_entityType_entityId', ['entityType', 'entityId'])
export class ForumVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entityType: string; // 'thread' | 'comment'

  @Column()
  entityId: string;

  /**
   * Issue #990 — a synthetic 'anonymous' value could previously collide
   * across every unauthenticated voter, corrupting vote tallies. The FK
   * guarantees every vote is tied to a real, distinct user.
   */
  @Column({ type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'int' })
  value: number; // 1 or -1

  @CreateDateColumn()
  createdAt: Date;
}
