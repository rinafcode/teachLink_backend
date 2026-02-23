import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionService } from '../transaction.service';
import { Transactional } from '../transactional.decorator';

/**
 * Example: Payment Transaction
 * Demonstrates atomic payment processing with transaction management
 */
@Injectable()
export class PaymentTransactionExample {
  private readonly logger = new Logger(PaymentTransactionExample.name);

  constructor(
    private readonly transactionService: TransactionService,
    // @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    // @InjectRepository(User) private userRepo: Repository<User>,
    // @InjectRepository(Transaction) private transactionRepo: Repository<Transaction>,
  ) {}

  /**
   * Process payment with transaction
   * Ensures all steps succeed or all fail together
   */
  async processPayment(
    userId: string,
    amount: number,
    recipientId: string,
  ): Promise<any> {
    return this.transactionService.runInTransaction(async (manager) => {
      // 1. Deduct from sender
      const sender = await manager.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING *',
        [amount, userId],
      );

      if (!sender || sender.length === 0) {
        throw new Error('Insufficient balance');
      }

      // 2. Add to recipient
      await manager.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [amount, recipientId],
      );

      // 3. Create payment record
      const payment = await manager.query(
        'INSERT INTO payments (user_id, recipient_id, amount, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, recipientId, amount, 'completed'],
      );

      // 4. Create transaction log
      await manager.query(
        'INSERT INTO transaction_logs (payment_id, type, amount) VALUES ($1, $2, $3)',
        [payment[0].id, 'payment', amount],
      );

      this.logger.log(`Payment processed: ${amount} from ${userId} to ${recipientId}`);

      return payment[0];
    });
  }

  /**
   * Process payment with retry on deadlock
   */
  async processPaymentWithRetry(
    userId: string,
    amount: number,
    recipientId: string,
  ): Promise<any> {
    return this.transactionService.runWithRetry(
      async (manager) => {
        return this.processPaymentLogic(manager, userId, amount, recipientId);
      },
      3, // max retries
      1000, // initial delay
    );
  }

  /**
   * Process payment with serializable isolation
   * Prevents concurrent modifications
   */
  async processPaymentSerializable(
    userId: string,
    amount: number,
    recipientId: string,
  ): Promise<any> {
    return this.transactionService.runWithIsolationLevel(
      'SERIALIZABLE',
      async (manager) => {
        return this.processPaymentLogic(manager, userId, amount, recipientId);
      },
    );
  }

  /**
   * Refund payment (rollback scenario)
   */
  async refundPayment(paymentId: string): Promise<any> {
    return this.transactionService.runInTransaction(async (manager) => {
      // 1. Get payment details
      const payment = await manager.query(
        'SELECT * FROM payments WHERE id = $1 AND status = $2',
        [paymentId, 'completed'],
      );

      if (!payment || payment.length === 0) {
        throw new Error('Payment not found or already refunded');
      }

      const { user_id, recipient_id, amount } = payment[0];

      // 2. Reverse the payment
      await manager.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [amount, user_id],
      );

      await manager.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [amount, recipient_id],
      );

      // 3. Update payment status
      await manager.query(
        'UPDATE payments SET status = $1, refunded_at = NOW() WHERE id = $2',
        ['refunded', paymentId],
      );

      // 4. Create refund log
      await manager.query(
        'INSERT INTO transaction_logs (payment_id, type, amount) VALUES ($1, $2, $3)',
        [paymentId, 'refund', amount],
      );

      this.logger.log(`Payment refunded: ${paymentId}`);

      return { success: true, paymentId };
    });
  }

  /**
   * Helper method for payment logic
   */
  private async processPaymentLogic(
    manager: any,
    userId: string,
    amount: number,
    recipientId: string,
  ): Promise<any> {
    const sender = await manager.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING *',
      [amount, userId],
    );

    if (!sender || sender.length === 0) {
      throw new Error('Insufficient balance');
    }

    await manager.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2',
      [amount, recipientId],
    );

    const payment = await manager.query(
      'INSERT INTO payments (user_id, recipient_id, amount, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, recipientId, amount, 'completed'],
    );

    return payment[0];
  }
}
