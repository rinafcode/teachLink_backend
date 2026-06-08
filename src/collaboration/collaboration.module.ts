import { Module } from '@nestjs/common';
import { OtCrdtService } from './ot-crdt.service';
import { PresenceService } from './presence.service';
import { ChangeHistoryService } from './change-history.service';
import { CollaborationGateway } from './collaboration.gateway';

@Module({
  providers: [OtCrdtService, PresenceService, ChangeHistoryService, CollaborationGateway],
  exports: [OtCrdtService, PresenceService, ChangeHistoryService],
})
export class CollaborationModule {}
