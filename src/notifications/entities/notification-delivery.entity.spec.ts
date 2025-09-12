import {
  NotificationDelivery,
  DeliveryStatus,
} from './notification-delivery.entity';

describe('NotificationDelivery Entity', () => {
  it('should instantiate with correct status', () => {
    const delivery = new NotificationDelivery();
    delivery.status = DeliveryStatus.PENDING;
    expect(delivery.status).toBe(DeliveryStatus.PENDING);
  });

  it('should update status', () => {
    const delivery = new NotificationDelivery();
    delivery.status = DeliveryStatus.PENDING;
    delivery.status = DeliveryStatus.SENT;
    expect(delivery.status).toBe(DeliveryStatus.SENT);
  });
});
