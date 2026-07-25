import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PaymentMethod as PaymentMethodType } from './payment.entity';

@Entity('payment_methods')
@Index(['userId', 'isDefault'])
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column({ type: 'enum', enum: PaymentMethodType })
  method: PaymentMethodType;

  @Column({ type: 'varchar', nullable: true })
  provider?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  displayName?: string;

  @Column({ type: 'varchar', length: 4, nullable: true })
  last4?: string;

  @Column({ type: 'int', nullable: true })
  expiryMonth?: number;

  @Column({ type: 'int', nullable: true })
  expiryYear?: number;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
