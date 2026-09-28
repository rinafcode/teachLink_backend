import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from '../common/constants/throttle.constants';
import { CustomThrottleGuard } from '../common/guards/throttle.guard';
import { EmailUnsubscribeService } from './email-unsubscribe.service';
import { UnsubscribeDto, ResubscribeDto, UpdateEmailPreferencesDto } from './dto/unsubscribe.dto';

@ApiTags('email-unsubscribe')
@UseGuards(CustomThrottleGuard)
@Controller('email-unsubscribe')
export class EmailUnsubscribeController {
  constructor(private readonly emailUnsubscribeService: EmailUnsubscribeService) {}

  @Post('unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'One-click unsubscribe via token' })
  @ApiResponse({ status: 204, description: 'Successfully unsubscribed' })
  @Throttle({ default: THROTTLE.AUTH_DEFAULT })
  async unsubscribe(@Body() dto: UnsubscribeDto): Promise<void> {
    await this.emailUnsubscribeService.unsubscribe(dto);
  }

  @Post('resubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Resubscribe to emails' })
  @ApiResponse({ status: 204, description: 'Successfully resubscribed' })
  @Throttle({ default: THROTTLE.MODERATE })
  async resubscribe(@Body() dto: ResubscribeDto): Promise<void> {
    await this.emailUnsubscribeService.resubscribe(dto);
  }

  @Post('preferences')
  @ApiOperation({ summary: 'Update email type preferences' })
  @Throttle({ default: THROTTLE.MODERATE })
  async updatePreferences(@Body() dto: UpdateEmailPreferencesDto) {
    return this.emailUnsubscribeService.updatePreferences(dto);
  }

  @Get('status/:email')
  @ApiOperation({ summary: 'Get subscription status for an email' })
  @Throttle({ default: THROTTLE.MODERATE })
  async getStatus(@Param('email') email: string) {
    return this.emailUnsubscribeService.getSubscriptionStatus(email);
  }
}
