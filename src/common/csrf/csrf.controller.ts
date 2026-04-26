import { Controller, Get, Post, UseGuards, Req, Res, HttpStatus, HttpCode } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, IApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CsrfService } from './csrf.service';

@ApiTags('CSRF')
@Controller('csrf')
export class CsrfController {
  constructor(private readonly csrfService: CsrfService) {}

  @Get('token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get CSRF token' })
  @IApiResponse({ status: 200, description: 'CSRF token generated successfully' })
  getCsrfToken(@Req() req: Request, @Res() res: Response): void {
    const sessionId = this.getSessionId(req);
    const token = this.csrfService.generateToken(sessionId);

    res.setHeader('X-CSRF-Token', token);
    res.json({ csrfToken: token });
  }

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate CSRF token' })
  @IApiResponse({ status: 200, description: 'CSRF token is valid' })
  @IApiResponse({ status: 400, description: 'Invalid CSRF token' })
  validateCsrfToken(@Req() req: Request): { valid: boolean } {
    const sessionId = this.getSessionId(req);
    const token = req.body?.csrfToken || req.headers['x-csrf-token'];

    const isValid = this.csrfService.validateToken(sessionId, token);
    return { valid: isValid };
  }

  @Post('invalidate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invalidate CSRF token' })
  @IApiResponse({ status: 200, description: 'CSRF token invalidated successfully' })
  invalidateCsrfToken(@Req() req: Request): { message: string } {
    const sessionId = this.getSessionId(req);
    this.csrfService.invalidateToken(sessionId);

    return { message: 'CSRF token invalidated successfully' };
  }

  private getSessionId(req: Request): string {
    if ((req as any).session?.id) {
      return (req as any).session.id;
    }
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
}
