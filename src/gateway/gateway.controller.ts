import {
  All,
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RouteConfigDto } from './dto/gateway.dto';
import { GatewayRateLimitGuard } from './guards/gateway-rate-limit.guard';
import { RequestTransformInterceptor } from './interceptors/request-transform.interceptor';
import { ResponseCacheInterceptor } from './interceptors/response-cache.interceptor';
import { GatewayRoutingService } from './services/gateway-routing.service';

@ApiTags('gateway')
@Controller('gateway')
@UseInterceptors(RequestTransformInterceptor, ResponseCacheInterceptor)
@UseGuards(GatewayRateLimitGuard)
export class GatewayController {
  constructor(private readonly routing: GatewayRoutingService) {}

  /**
   * Proxy any HTTP method to the upstream service.
   * Route: /gateway/:service/*path
   */
  @All(':service/*path')
  @ApiOperation({ summary: 'Proxy request to upstream service' })
  @ApiParam({ name: 'service', description: 'Registered service name' })
  async proxy(
    @Param('service') service: string,
    @Param('path') path: string,
    @Req() req: Request,
    @Res() res: Response,
    @Body() body?: unknown,
  ): Promise<void> {
    const forwardHeaders = { ...(req.headers as Record<string, string>) };
    delete forwardHeaders['host'];

    const result = await this.routing.proxy(service, `/${path}`, req.method, forwardHeaders, body);

    res.status(result.status).json(result.data);
  }

  /**
   * Register or update a route at runtime.
   */
  @Post('routes')
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a new upstream route' })
  registerRoute(@Body() dto: RouteConfigDto): { message: string } {
    this.routing.registerRoute({
      service: dto.service,
      upstream: dto.upstream,
      weight: dto.weight ?? 1,
      cacheTtlSeconds: dto.cacheTtlSeconds ?? 0,
      rateLimitPerMinute: dto.rateLimitPerMinute ?? 100,
    });
    return { message: `Route "${dto.service}" registered` };
  }
}
