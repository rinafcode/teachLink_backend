import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Represents the email Subscription entity.
 */
@Entity('email_subscriptions')
@Index(['email'], { unique: true })
export class EmailSubscription {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @ApiProperty()
  @Column({ unique: true })
  email: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  userId?: string;

  @ApiProperty()
  @Column({ default: true })
  isSubscribed: boolean;

  @ApiProperty({ type: [String] })
  @Column('simple-array', { nullable: true })
  preferences?: string[]; // e.g., ['marketing', 'product_updates', 'newsletters']

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  unsubscribedAt?: Date;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  unsubscribeReason?: string;

  @ApiProperty()
  @CreateDateColumn()
  subscribedAt: Date;
}
