import { Controller, UseGuards, Get, Patch, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';

@Controller('ccpa')
@UseGuards(JwtAuthGuard)
export class CcpaController {
  @Get('disclosure')
  async getDisclosure(): Promise<any> {
    return { status: 'success', disclosure: 'disclosure info' };
  }

  @Get('know')
  async getKnow(): Promise<any> {
    return { status: 'success', data: [] };
  }

  @Get('preferences')
  async getPreferences(): Promise<any> {
    return { status: 'success', preferences: {} };
  }

  @Patch('opt-out')
  async patchOptOut(): Promise<any> {
    return { status: 'success', optedOut: true };
  }

  @Delete('delete')
  async deleteData(): Promise<any> {
    return { status: 'success', deleted: true };
  }
}
