import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { OtCrdtService } from './ot-crdt.service';
import { PresenceService } from './presence.service';
import { ChangeHistoryService } from './change-history.service';
import { CollaborationGateway } from './collaboration.gateway';
import { WsPayloadSizeGuardService } from './guards/ws-payload-size-guard.service';
import { WsJwtAuthGuard } from './guards/ws-jwt-auth.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-jwt-secret',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any },
    }),
  ],
  providers: [
    OtCrdtService,
    PresenceService,
    ChangeHistoryService,
    CollaborationGateway,
    WsPayloadSizeGuardService,
    WsJwtAuthGuard,
  ],
  exports: [OtCrdtService, PresenceService, ChangeHistoryService],
})
export class CollaborationModule {}
