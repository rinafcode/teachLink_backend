import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('unsubscribe_tokens')
export class UnsubscribeToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  token: string;

  @Column()
  @Index()
  email: string;

  @Column({ nullable: true })
  userId?: string;

  @Column({ nullable: true })
  emailType?: string;

  @Column({ default: false })
  used: boolean;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}