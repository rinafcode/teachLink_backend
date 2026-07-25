import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EmailUnsubscribeService } from './email-unsubscribe.service';
import { UnsubscribeDto, ResubscribeDto, UpdateEmailPreferencesDto } from './dto/unsubscribe.dto';

@ApiTags('email-unsubscribe')
@Controller('email-unsubscribe')
export class EmailUnsubscribeController {
  constructor(private readonly emailUnsubscribeService: EmailUnsubscribeService) {}

  @Post('unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'One-click unsubscribe via token' })
  @ApiResponse({ status: 204, description: 'Successfully unsubscribed' })
  async unsubscribe(@Body() dto: UnsubscribeDto): Promise<void> {
    await this.emailUnsubscribeService.unsubscribe(dto);
  }

  @Post('resubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Resubscribe to emails' })
  @ApiResponse({ status: 204, description: 'Successfully resubscribed' })
  async resubscribe(@Body() dto: ResubscribeDto): Promise<void> {
    await this.emailUnsubscribeService.resubscribe(dto);
  }

  @Post('preferences')
  @ApiOperation({ summary: 'Update email type preferences' })
  async updatePreferences(@Body() dto: UpdateEmailPreferencesDto) {
    return this.emailUnsubscribeService.updatePreferences(dto);
  }

  @Get('status/:email')
  @ApiOperation({ summary: 'Get subscription status for an email' })
  async getStatus(@Param('email') email: string) {
    return this.emailUnsubscribeService.getSubscriptionStatus(email);
  }
}
