import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  VersionColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Payment } from './payment.entity';
import { User } from '../../users/entities/user.entity';

// ... (InvoiceStatus and InvoiceItem definitions remain the same)

/**
 * Represents the invoice entity.
 */
@Entity('invoices')
export class Invoice {
  // ... (previous fields remain the same)
  
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
