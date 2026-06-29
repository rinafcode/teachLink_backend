import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PricingService } from '../services/pricing.service';
import { LocalizedPriceDto, PricingDto } from '../../currency/dtos/currency.dto';

/**
 * Pricing Controller for Payments
 * Handles pricing queries and localized pricing display
 */
@ApiTags('Pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  /**
   * Get localized price for a product
   * POST /pricing/localize
   */
  @Post('localize')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get localized pricing for a product',
    description: 'Converts base price to user currency and formats for display',
  })
  @ApiResponse({
    status: 200,
    description: 'Localized price information',
    type: LocalizedPriceDto,
  })
  async getLocalizedPrice(
    @Body()
    body: {
      basePrice: number;
      baseCurrency: string;
      userCurrency: string;
      userLocale?: string;
    },
  ): Promise<LocalizedPriceDto> {
    return this.pricingService.getLocalizedPrice(
      body.basePrice,
      body.baseCurrency,
      body.userCurrency,
      body.userLocale || 'en-US',
    );
  }

  /**
   * Get pricing for payment processing
   * POST /pricing/for-payment
   */
  @Post('for-payment')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get pricing ready for payment processing',
    description: 'Prepares pricing info including rounding and exchange rates',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment-ready pricing information',
    type: PricingDto,
  })
  async getPricingForPayment(
    @Body()
    body: {
      basePrice: number;
      baseCurrency: string;
      paymentCurrency: string;
    },
  ): Promise<PricingDto> {
    return this.pricingService.getPricingForPayment(
      body.basePrice,
      body.baseCurrency,
      body.paymentCurrency,
    );
  }

  /**
   * Get multi-currency pricing
   * POST /pricing/multi-currency
   */
  @Post('multi-currency')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get pricing in multiple currencies',
    description: 'Returns pricing options in specified currencies',
  })
  async getMultiCurrencyPricing(
    @Body()
    body: {
      basePrice: number;
      baseCurrency: string;
      targetCurrencies: string[];
    },
  ): Promise<Record<string, PricingDto>> {
    return this.pricingService.getMultiCurrencyPricing(
      body.basePrice,
      body.baseCurrency,
      body.targetCurrencies,
    );
  }

  /**
   * Apply discount to pricing
   * POST /pricing/apply-discount
   */
  @Post('apply-discount')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Apply discount to pricing',
  })
  applyDiscount(
    @Body()
    body: {
      pricing: PricingDto;
      discountPercent: number;
    },
  ): PricingDto {
    return this.pricingService.applyDiscount(body.pricing, body.discountPercent);
  }

  /**
   * Apply tax to pricing
   * POST /pricing/apply-tax
   */
  @Post('apply-tax')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Apply tax to pricing',
  })
  applyTax(
    @Body()
    body: {
      pricing: PricingDto;
      taxPercent: number;
    },
  ): PricingDto {
    return this.pricingService.applyTax(body.pricing, body.taxPercent);
  }
}
