import { Controller, Get, Put, UseGuards, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TimeoutConfigService, TimeoutConfig } from './timeout-config.service';
@ApiTags('Timeout Configuration')
@ApiBearerAuth()
@Controller('timeout')
@UseGuards(JwtAuthGuard)
export class TimeoutController {
    constructor(private readonly timeoutConfig: TimeoutConfigService) { }
    @Get('config')
    @ApiOperation({ summary: 'Get current timeout configuration' })
    @ApiResponse({ status: 200, description: 'Timeout configuration retrieved successfully' })
    getConfig(): TimeoutConfig {
        return this.timeoutConfig.getConfig();
    }
    @Put('default')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update default timeout' })
    @ApiResponse({ status: 200, description: 'Default timeout updated successfully' })
    updateDefaultTimeout(
    @Body()
    body: {
        timeout: number;
    }): {
        message: string;
        timeout: number;
    } {
        this.timeoutConfig.updateDefaultTimeout(body.timeout);
        return {
            message: 'Default timeout updated successfully',
            timeout: body.timeout,
        };
    }
    @Put('endpoint')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update endpoint timeout' })
    @ApiResponse({ status: 200, description: 'Endpoint timeout updated successfully' })
    updateEndpointTimeout(
    @Body()
    body: {
        path: string;
        timeout: number;
    }): {
        message: string;
    } {
        this.timeoutConfig.updateEndpointTimeout(body.path, body.timeout);
        return {
            message: `Endpoint timeout updated successfully for ${body.path}`,
        };
    }
    @Put('method')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update HTTP method timeout' })
    @ApiResponse({ status: 200, description: 'Method timeout updated successfully' })
    updateMethodTimeout(
    @Body()
    body: {
        method: string;
        timeout: number;
    }): {
        message: string;
    } {
        this.timeoutConfig.updateMethodTimeout(body.method, body.timeout);
        return {
            message: `Method timeout updated successfully for ${body.method}`,
        };
    }
    @Get('check')
    @ApiOperation({ summary: 'Get timeout for a specific request' })
    @ApiResponse({ status: 200, description: 'Timeout calculated successfully' })
    checkTimeout(
    @Body()
    body: {
        method: string;
        path: string;
    }): {
        timeout: number;
        source: string;
    } {
        const timeout = this.timeoutConfig.getTimeoutForRequest(body.method, body.path);
        const endpointTimeout = this.timeoutConfig.getEndpointTimeout(body.path);
        const methodTimeout = this.timeoutConfig.getMethodTimeout(body.method);
        let source = 'default';
        if (endpointTimeout) {
            source = 'endpoint';
        }
        else if (methodTimeout) {
            source = 'method';
        }
        return {
            timeout,
            source,
        };
    }
}
