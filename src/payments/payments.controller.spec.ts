import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { expectNotFound, expectUnauthorized, expectValidationFailure } from '../../test/utils';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let paymentsService: {
    createPaymentIntent: jest.Mock;
    processRefund: jest.Mock;
    getInvoice: jest.Mock;
  };

  const request = { user: { id: 'user-1' } };
  const createPaymentDto: CreatePaymentDto = {
    courseId: 'course-1',
    amount: 120,
    provider: 'stripe',
  };

  beforeEach(async () => {
    paymentsService = {
      createPaymentIntent: jest.fn(),
      processRefund: jest.fn(),
      getInvoice: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: paymentsService }],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('returns payment intent for valid request', async () => {
    paymentsService.createPaymentIntent.mockResolvedValue({
      paymentId: 'payment-1',
      clientSecret: 'cs_123',
      requiresAction: false,
    });

    await expect(controller.createPaymentIntent(request, createPaymentDto)).resolves.toMatchObject({
      paymentId: 'payment-1',
      clientSecret: 'cs_123',
      requiresAction: false,
    });

    expect(paymentsService.createPaymentIntent).toHaveBeenCalledWith('user-1', createPaymentDto);
  });

  it('returns validation failure for invalid refund request', async () => {
    paymentsService.processRefund.mockRejectedValue(
      new BadRequestException('Invalid refund amount'),
    );

    await expectValidationFailure(() =>
      controller.processRefund({ paymentId: 'payment-1', amount: -1 }),
    );
  });

  it('returns not found when invoice is missing', async () => {
    paymentsService.getInvoice.mockRejectedValue(new NotFoundException('Payment not found'));

    await expectNotFound(() => controller.getInvoice('missing', request));
  });

  it('returns unauthorized when access token is invalid', async () => {
    paymentsService.createPaymentIntent.mockRejectedValue(
      new UnauthorizedException('Invalid token'),
    );

    await expectUnauthorized(() => controller.createPaymentIntent(request, createPaymentDto));
  });
});
