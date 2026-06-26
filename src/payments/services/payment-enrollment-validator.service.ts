import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class PaymentEnrollmentValidatorService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  async validateEnrollmentExists(enrollmentId: string): Promise<boolean> {
    if (!enrollmentId) return true;
    const result = await this.paymentRepo.query(
      'SELECT id FROM enrollments WHERE id = $1',
      [enrollmentId],
    );
    return result.length > 0;
  }

  async findOrphanedPayments(): Promise<Payment[]> {
    return this.paymentRepo.query(
      'SELECT p.* FROM payments p LEFT JOIN enrollments e ON e.id = p."enrollmentId" WHERE p."enrollmentId" IS NOT NULL AND e.id IS NULL',
    );
  }
}
