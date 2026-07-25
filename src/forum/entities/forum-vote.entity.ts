import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

@Entity('forum_votes')
@Unique(['entityType', 'entityId', 'authorId'])
export class ForumVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entityType: string; // 'thread' | 'comment'

  @Column()
  entityId: string;

  @Column()
  authorId: string;

  @Column({ type: 'int' })
  value: number; // 1 or -1

  @CreateDateColumn()
  createdAt: Date;
}
