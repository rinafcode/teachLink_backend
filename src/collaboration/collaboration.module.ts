import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OtCrdtService } from './ot-crdt.service';
import { PresenceService } from './presence.service';
import { ChangeHistoryService } from './change-history.service';
import { CollaborationGateway } from './collaboration.gateway';
import { WsPayloadSizeGuardService } from './guards/ws-payload-size-guard.service';

@Module({
  imports: [ConfigModule],
  providers: [
    OtCrdtService,
    PresenceService,
    ChangeHistoryService,
    CollaborationGateway,
    WsPayloadSizeGuardService,
  ],
  exports: [OtCrdtService, PresenceService, ChangeHistoryService],
})
export class CollaborationModule {}
