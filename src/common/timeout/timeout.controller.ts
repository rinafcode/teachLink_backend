import { Controller, Get, Put, UseGuards, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TimeoutConfigService, ITimeoutConfig } from './timeout-config.service';

/**
 * Exposes timeout endpoints.
 */
@ApiTags('Timeout Configuration')
@ApiBearerAuth()
@Controller('timeout')
@UseGuards(JwtAuthGuard)
export class TimeoutController {
  constructor(private readonly timeoutConfig: TimeoutConfigService) {}

  /**
   * Returns config.
   * @returns The resulting timeout config.
   */
  @Get('config')
  @ApiOperation({ summary: 'Get current timeout configuration' })
  @ApiResponse({ status: 200, description: 'Timeout configuration retrieved successfully' })
  getConfig(): ITimeoutConfig {
    return this.timeoutConfig.getConfig();
  }

  /**
   * Updates default Timeout.
   * @param body The body.
   * @returns The operation result.
   */
  @Put('default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update default timeout' })
  @ApiResponse({ status: 200, description: 'Default timeout updated successfully' })
  updateDefaultTimeout(@Body() body: { timeout: number }): { message: string; timeout: number } {
    this.timeoutConfig.updateDefaultTimeout(body.timeout);
    return {
      message: 'Default timeout updated successfully',
      timeout: body.timeout,
    };
  }

  /**
   * Updates endpoint Timeout.
   * @param body The body.
   * @returns The operation result.
   */
  @Put('endpoint')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update endpoint timeout' })
  @ApiResponse({ status: 200, description: 'Endpoint timeout updated successfully' })
  updateEndpointTimeout(@Body() body: { path: string; timeout: number }): { message: string } {
    this.timeoutConfig.updateEndpointTimeout(body.path, body.timeout);
    return {
      message: `Endpoint timeout updated successfully for ${body.path}`,
    };
  }

  /**
   * Updates method Timeout.
   * @param body The body.
   * @returns The operation result.
   */
  @Put('method')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update HTTP method timeout' })
  @ApiResponse({ status: 200, description: 'Method timeout updated successfully' })
  updateMethodTimeout(@Body() body: { method: string; timeout: number }): { message: string } {
    this.timeoutConfig.updateMethodTimeout(body.method, body.timeout);
    return {
      message: `Method timeout updated successfully for ${body.method}`,
    };
  }

  /**
   * Validates timeout.
   * @param body The body.
   * @returns The operation result.
   */
  @Get('check')
  @ApiOperation({ summary: 'Get timeout for a specific request' })
  @ApiResponse({ status: 200, description: 'Timeout calculated successfully' })
  checkTimeout(@Body() body: { method: string; path: string }): {
    timeout: number;
    source: string;
  } {
    const timeout = this.timeoutConfig.getTimeoutForRequest(body.method, body.path);
    const endpointTimeout = this.timeoutConfig.getEndpointTimeout(body.path);
    const methodTimeout = this.timeoutConfig.getMethodTimeout(body.method);

    let source = 'default';
    if (endpointTimeout) {
      source = 'endpoint';
    } else if (methodTimeout) {
      source = 'method';
    }

    return {
      timeout,
      source,
    };
  }
}
