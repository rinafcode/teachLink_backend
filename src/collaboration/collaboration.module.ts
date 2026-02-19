import { Module } from '@nestjs/common';
import { SharedDocumentService } from './documents/shared-document.service';
import { WhiteboardService } from './whiteboard/whiteboard.service';
import { VersionControlService } from './versioning/version-control.service';
import { CollaborationPermissionsService } from './permissions/collaboration-permissions.service';
import { CollaborationService } from './collaboration.service';
import { CollaborationGateway } from './gateway/collaboration.gateway';
import { CollaborationController } from './collaboration.controller';

@Module({
  imports: [],
  controllers: [CollaborationController],
  providers: [
    CollaborationService,
    SharedDocumentService,
    WhiteboardService,
    VersionControlService,
    CollaborationPermissionsService,
    CollaborationGateway,
  ],
  exports: [
    CollaborationService,
    SharedDocumentService,
    WhiteboardService,
    VersionControlService,
    CollaborationPermissionsService,
  ],
})
export class CollaborationModule {}