import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/entities/user.entity'; // Assuming a User entity exists

@Entity({ name: 'messages' })
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index('IDX_messages_senderId')
  senderId: string;

  @Column({ type: 'uuid' })
  @Index('IDX_messages_recipientId')
  recipientId: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ type: 'timestamptz' })
  @Index('IDX_messages_sender_recipient_createdAt')
  @Index('IDX_messages_recipient_sender_createdAt')
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  // Optional relations for convenience (may be lazy loaded)
  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipientId' })
  recipient: User;
}
