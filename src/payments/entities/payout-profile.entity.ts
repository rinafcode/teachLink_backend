import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('instructor_payout_profiles')
export class InstructorPayoutProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'instructor_id', unique: true })
  @Index()
  instructorId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instructor_id' })
  instructor: User;

  @Column({ type: 'varchar', default: 'monthly' })
  payoutSchedule: string; // 'weekly', 'monthly', 'instant'

  @Column({ type: 'varchar', default: 'paypal' })
  payoutMethod: string; // 'paypal', 'bank_transfer'

  @Column({ type: 'varchar', nullable: true })
  payoutDetails: string; // paypal email or bank details

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
