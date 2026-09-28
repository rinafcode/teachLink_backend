import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from '../entities/payment-method.entity';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './payment-methods.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
  ) {}

  async listMethods(userId: string): Promise<PaymentMethod[]> {
    return this.paymentMethodRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async addMethod(userId: string, dto: CreatePaymentMethodDto): Promise<PaymentMethod> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    if (dto.isDefault) {
      await this.clearDefaultForUser(userId);
    }

    const paymentMethod = this.paymentMethodRepository.create({
      ...dto,
      userId,
      isDefault: dto.isDefault ?? false,
    });

    return this.paymentMethodRepository.save(paymentMethod);
  }

  async updateMethod(
    userId: string,
    id: string,
    dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    const method = await this.requireOwnedMethod(userId, id);

    if (dto.isDefault) {
      await this.clearDefaultForUser(userId);
    }

    Object.assign(method, dto);
    return this.paymentMethodRepository.save(method);
  }

  async removeMethod(userId: string, id: string): Promise<void> {
    await this.requireOwnedMethod(userId, id);
    await this.paymentMethodRepository.softDelete(id);
  }

  async setDefaultMethod(userId: string, id: string): Promise<PaymentMethod> {
    const method = await this.requireOwnedMethod(userId, id);
    await this.clearDefaultForUser(userId);
    method.isDefault = true;
    return this.paymentMethodRepository.save(method);
  }

  private async requireOwnedMethod(userId: string, id: string): Promise<PaymentMethod> {
    const method = await this.paymentMethodRepository.findOne({ where: { id, userId } });
    if (!method) {
      throw new NotFoundException('Payment method not found');
    }
    return method;
  }

  private async clearDefaultForUser(userId: string): Promise<void> {
    await this.paymentMethodRepository.update({ userId, isDefault: true }, { isDefault: false });
  }
}
