import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TransactionService } from '../database/transaction.service';
import { TransactionHelperService } from '../database/transaction-helper.service';
// Mock entities for example
interface IUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  lastLoginAt?: Date | null;
  status?: string;
  profileCompleted?: boolean;
}

interface IPayment {
  id: string;
  userId: string;
  amount: number;
  status: string;
  description: string;
  createdAt: Date;
  completedAt?: Date;
}
interface Invoice {
    id: string;
    userId: string;
    paymentId: string;
    amount: number;
    status: string;
    description: string;
    createdAt: Date;
    dueDate: Date;
    paidAt?: Date;
}
/**
 * Example service demonstrating transaction management
 * Shows atomic operations for complex business logic
 */
@Injectable()
export class TransactionExampleService {
  private readonly logger = new Logger(TransactionExampleService.name);

  constructor(
    private readonly userRepository: Repository<IUser>,
    private readonly transactionService: TransactionService,
    private readonly transactionHelper: TransactionHelperService,
    private readonly paymentRepository: Repository<IPayment>,
    private readonly invoiceRepository: Repository<Invoice>,
  ) {}

  /**
   * Example: Atomic user registration with email verification
   * All operations succeed or fail together
   */
  async registerUserWithVerification(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<{ userId: string; verificationToken: string }> {
    return await this.transactionService.runInTransaction(async (_manager) => {
      // Create user
      const user = await this.userRepository.save({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        isEmailVerified: false,
        lastLoginAt: null,
      });

      // Generate verification token
      const verificationToken = this.generateVerificationToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Save verification token
      await this.userRepository.update(user.id, {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: expiresAt,
      } as any);

      this.logger.log(
        `User registered with ID: ${user.id}, verification token: ${verificationToken}`,
      );

      return {
        userId: user.id,
        verificationToken,
      };
    });
  }

  /**
   * Example: Payment with invoice creation
   * Demonstrates atomic payment processing
   */
  async processPaymentWithInvoice(paymentData: {
    userId: string;
    amount: number;
    description: string;
  }): Promise<{ paymentId: string; invoiceId: string }> {
    return await this.transactionService.runWithRetry(async (_manager) => {
      // Create payment record
      const payment = await this.paymentRepository.save({
        userId: paymentData.userId,
        amount: paymentData.amount,
        status: 'PENDING' as any,
        description: paymentData.description,
        createdAt: new Date(),
      });

      // Create invoice
      const invoice = await this.invoiceRepository.save({
        userId: paymentData.userId,
        paymentId: payment.id,
        amount: paymentData.amount,
        status: 'PENDING' as any,
        description: paymentData.description,
        createdAt: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 1000), // 30 days
      });

      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update payment status
      await this.paymentRepository.update(payment.id, {
        status: 'COMPLETED' as any,
        completedAt: new Date(),
      } as any);

      // Update invoice status
      await this.invoiceRepository.update(invoice.id, {
        status: 'PAID' as any,
        paidAt: new Date(),
      } as any);

      this.logger.log(`Payment processed: ${payment.id}, Invoice: ${invoice.id}`);

      return {
        paymentId: payment.id,
        invoiceId: invoice.id,
      };
    });
  }

  /**
   * Example: Complex operation with conditional rollback
   */
  async processWithConditionalRollback(userId: string, data: any): Promise<any> {
    return await this.transactionHelper.executeWithRollback([
      {
        operation: async (_manager) => {
          // Step 1: Update user
          await this.userRepository.update(userId, {
            lastLoginAt: new Date(),
            status: 'ACTIVE',
          } as any);
          return { step: 'user_updated', userId };
        },
        rollback: async (_manager) => {
          // Rollback user status
          await this.userRepository.update(userId, {
            lastLoginAt: null,
            status: 'INACTIVE',
          } as any);
          this.logger.warn(`Rolled back user status for ${userId}`);
        },
      },
      {
        operation: async (_manager) => {
          // Step 2: Create related record
          const record = await this.someRecordRepository.save({
            userId,
            data,
            createdAt: new Date(),
          });
          return { step: 'record_created', userId: record.id };
        },
        rollback: async (_manager) => {
          // Rollback record creation
          this.logger.warn('Rolled back record creation');
        },
        condition: () => Math.random() > 0.5, // 50% chance of success
      },
    ]);
  }

  /**
   * Example: Savepoint usage for nested operations
   */
  async complexNestedOperation(userId: string): Promise<void> {
    return await this.transactionService.runInTransaction(async (manager) => {
      // Create savepoint for first operation
      await this.transactionHelper.createSavepoint(manager, 'user_update');

      try {
        // Update user
        await this.userRepository.update(userId, {
          lastLoginAt: new Date(),
          profileCompleted: true,
        } as any);

        // Create savepoint for second operation
        await this.transactionHelper.createSavepoint(manager, 'profile_setup');

        // Second operation that might fail
        if (Math.random() > 0.3) {
          throw new Error('Profile setup failed');
        }

        this.logger.log('Profile setup completed successfully');
      } catch (error) {
        // Rollback to first savepoint
        await this.transactionHelper.rollbackToSavepoint(manager, 'user_update');
        this.logger.error('Profile setup failed, rolled back to user_update');
        throw error;
      }
    });
  }

  private generateVerificationToken(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  // Mock repository for example
  private get someRecordRepository(): Repository<any> {
    return this.userRepository as any;
  }
}
