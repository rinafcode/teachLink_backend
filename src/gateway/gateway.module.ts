import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GatewayController } from './gateway.controller';
import { GatewayRoutingService } from './services/gateway-routing.service';
import { GatewayRateLimitGuard } from './guards/gateway-rate-limit.guard';
import { RequestTransformInterceptor } from './interceptors/request-transform.interceptor';
import { ResponseCacheInterceptor } from './interceptors/response-cache.interceptor';

@Module({
  imports: [HttpModule],
  controllers: [GatewayController],
  providers: [
    GatewayRoutingService,
    GatewayRateLimitGuard,
    RequestTransformInterceptor,
    ResponseCacheInterceptor,
  ],
  exports: [GatewayRoutingService],
})
export class GatewayModule {}
