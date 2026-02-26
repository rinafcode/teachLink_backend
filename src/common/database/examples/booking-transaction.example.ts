import { Injectable, Logger } from '@nestjs/common';
import { TransactionService } from '../transaction.service';

/**
 * Example: Booking Transaction
 * Demonstrates atomic booking operations (consulting sessions, courses, etc.)
 */
@Injectable()
export class BookingTransactionExample {
  private readonly logger = new Logger(BookingTransactionExample.name);

  constructor(private readonly transactionService: TransactionService) {}

  /**
   * Book a consulting session
   * Ensures slot is reserved, payment is processed, and notification is sent atomically
   */
  async bookConsultingSession(
    userId: string,
    consultantId: string,
    slotId: string,
    amount: number,
  ): Promise<any> {
    return this.transactionService.runInTransaction(async (manager) => {
      // 1. Check and lock the slot
      const slot = await manager.query(
        'SELECT * FROM consulting_slots WHERE id = $1 AND status = $2 FOR UPDATE',
        [slotId, 'available'],
      );

      if (!slot || slot.length === 0) {
        throw new Error('Slot not available');
      }

      // 2. Check user balance
      const user = await manager.query(
        'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      );

      if (!user || user.length === 0 || user[0].balance < amount) {
        throw new Error('Insufficient balance');
      }

      // 3. Deduct payment from user
      await manager.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [amount, userId],
      );

      // 4. Add payment to consultant
      await manager.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [amount, consultantId],
      );

      // 5. Mark slot as booked
      await manager.query(
        'UPDATE consulting_slots SET status = $1, booked_by = $2, booked_at = NOW() WHERE id = $3',
        ['booked', userId, slotId],
      );

      // 6. Create booking record
      const booking = await manager.query(
        'INSERT INTO bookings (user_id, consultant_id, slot_id, amount, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [userId, consultantId, slotId, amount, 'confirmed'],
      );

      // 7. Create notification
      await manager.query(
        'INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3)',
        [userId, 'booking_confirmed', `Your session with consultant ${consultantId} is confirmed`],
      );

      await manager.query(
        'INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3)',
        [consultantId, 'new_booking', `New booking from user ${userId}`],
      );

      this.logger.log(`Booking created: ${booking[0].id}`);

      return booking[0];
    });
  }

  /**
   * Cancel booking with refund
   */
  async cancelBooking(bookingId: string, refundAmount: number): Promise<any> {
    return this.transactionService.runInTransaction(async (manager) => {
      // 1. Get booking details
      const booking = await manager.query(
        'SELECT * FROM bookings WHERE id = $1 AND status = $2 FOR UPDATE',
        [bookingId, 'confirmed'],
      );

      if (!booking || booking.length === 0) {
        throw new Error('Booking not found or already cancelled');
      }

      const { user_id, consultant_id, slot_id, amount } = booking[0];

      // 2. Refund user
      await manager.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [refundAmount, user_id],
      );

      // 3. Deduct from consultant
      await manager.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [refundAmount, consultant_id],
      );

      // 4. Free up the slot
      await manager.query(
        'UPDATE consulting_slots SET status = $1, booked_by = NULL, booked_at = NULL WHERE id = $2',
        ['available', slot_id],
      );

      // 5. Update booking status
      await manager.query(
        'UPDATE bookings SET status = $1, cancelled_at = NOW(), refund_amount = $2 WHERE id = $3',
        ['cancelled', refundAmount, bookingId],
      );

      // 6. Create notifications
      await manager.query(
        'INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3)',
        [user_id, 'booking_cancelled', `Your booking has been cancelled. Refund: $${refundAmount}`],
      );

      this.logger.log(`Booking cancelled: ${bookingId}`);

      return { success: true, bookingId, refundAmount };
    });
  }

  /**
   * Reschedule booking
   */
  async rescheduleBooking(
    bookingId: string,
    newSlotId: string,
  ): Promise<any> {
    return this.transactionService.runInTransaction(async (manager) => {
      // 1. Get current booking
      const booking = await manager.query(
        'SELECT * FROM bookings WHERE id = $1 AND status = $2 FOR UPDATE',
        [bookingId, 'confirmed'],
      );

      if (!booking || booking.length === 0) {
        throw new Error('Booking not found');
      }

      const { slot_id: oldSlotId, user_id } = booking[0];

      // 2. Check new slot availability
      const newSlot = await manager.query(
        'SELECT * FROM consulting_slots WHERE id = $1 AND status = $2 FOR UPDATE',
        [newSlotId, 'available'],
      );

      if (!newSlot || newSlot.length === 0) {
        throw new Error('New slot not available');
      }

      // 3. Free old slot
      await manager.query(
        'UPDATE consulting_slots SET status = $1, booked_by = NULL WHERE id = $2',
        ['available', oldSlotId],
      );

      // 4. Book new slot
      await manager.query(
        'UPDATE consulting_slots SET status = $1, booked_by = $2, booked_at = NOW() WHERE id = $3',
        ['booked', user_id, newSlotId],
      );

      // 5. Update booking
      await manager.query(
        'UPDATE bookings SET slot_id = $1, rescheduled_at = NOW() WHERE id = $2',
        [newSlotId, bookingId],
      );

      // 6. Create notification
      await manager.query(
        'INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3)',
        [user_id, 'booking_rescheduled', 'Your booking has been rescheduled'],
      );

      this.logger.log(`Booking rescheduled: ${bookingId}`);

      return { success: true, bookingId, newSlotId };
    });
  }
}
