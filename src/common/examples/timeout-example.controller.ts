import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Timeout } from '../interceptors/timeout.interceptor';
@ApiTags('Timeout Examples')
@Controller('examples')
export class TimeoutExampleController {
    @Get('quick')
    @ApiOperation({ summary: 'Quick endpoint with custom timeout' })
    @Timeout(5000) // 5 seconds timeout
    getQuickResponse(): {
        message: string;
    } {
        // This endpoint will timeout after 5 seconds
        return { message: 'Quick response' };
    }
    @Get('slow')
    @ApiOperation({ summary: 'Slow endpoint with longer timeout' })
    @Timeout(120000) // 2 minutes timeout
    async getSlowResponse(): Promise<{
        message: string;
    }> {
        // Simulate a slow operation
        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 second delay
        return { message: 'Slow response completed' };
    }
    @Post('process')
    @ApiOperation({ summary: 'Processing endpoint with custom timeout' })
    @Timeout(60000) // 1 minute timeout
    async processData(
    @Body()
    _data: unknown): Promise<{
        result: string;
    }> {
        // Simulate data processing
        await new Promise((resolve) => setTimeout(resolve, 30000)); // 30 second processing
        return { result: 'Data processed successfully' };
    }
    @Get('default')
    @ApiOperation({ summary: 'Endpoint using default timeout' })
    getDefaultTimeout(): {
        message: string;
        timeout: string;
    } {
        // This endpoint will use the default timeout from configuration
        return {
            message: 'Using default timeout',
            timeout: 'Configured by REQUEST_TIMEOUT env var or default 30s',
        };
    }
}
