import { Injectable } from '@nestjs/common';
import { StripeService } from './stripe.service';

@Injectable()
export class ProviderFactoryService {
  constructor(private readonly stripeService: StripeService) {}

  getProvider(provider: string) {
    switch (provider.toLowerCase()) {
      case 'stripe':
        return this.stripeService;
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }
}