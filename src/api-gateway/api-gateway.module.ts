import { Module } from '@nestjs/common';
import { RoutingService } from './routing/routing.service';
import { GatewayAuthService } from './auth/gateway-auth.service';
import { TransformService } from './transformation/transform.service';
import { GatewayMonitoringService } from './monitoring/gateway-monitoring.service';
import { PolicyEnforcementService } from './policies/policy-enforcement.service';
import { APIGatewayController } from './api-gateway.controller';
import { MessagingModule } from '../messaging/messaging.module';
import { JwtModule } from '@nestjs/jwt';
import { RateLimitingModule } from '../rate-limiting/rate-limiting.module';

@Module({
  imports: [
    MessagingModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
    RateLimitingModule,
  ],
  providers: [
    RoutingService,
    GatewayAuthService,
    TransformService,
    GatewayMonitoringService,
    PolicyEnforcementService,
  ],
  controllers: [APIGatewayController],
  exports: [
    RoutingService,
    GatewayAuthService,
    TransformService,
    GatewayMonitoringService,
    PolicyEnforcementService,
  ],
})
export class APIGatewayModule {}
