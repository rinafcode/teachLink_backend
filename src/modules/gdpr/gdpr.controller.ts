import { Body, Controller, Delete, Get, Patch, Req, UseGuards } from '@nestjs/common';

@Controller('gdpr')
@UseGuards(JwtAuthGuard)
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  @Get('export')
  exportData(@Req() req) {
    return this.gdprService.exportUserData(req.user.id);
  }

  @Delete('erase')
  eraseData(@Req() req) {
    return this.gdprService.eraseUserData(req.user.id);
  }

  @Patch('consent')
  updateConsent(
    @Req() req,

    @Body()
    dto: ConsentDto,
  ) {
    return this.gdprService.updateConsent(req.user.id, dto);
  }

  @Get('consent')
  getConsents(@Req() req) {
    return this.gdprService.getConsents(req.user.id);
  }
}
