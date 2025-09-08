import { Module } from '@nestjs/common';
import { CollaborationService } from './collaboration.service';
import { SharedDocumentService } from './documents/shared-document.service';
import { WhiteboardService } from './whiteboard/whiteboard.service';
import { VersionControlService } from './versioning/version-control.service';
import { CollaborationPermissionsService } from './permissions/collaboration-permissions.service';
import { ConflictResolutionService } from './conflict/conflict-resolution.service';
import { CollaborationController } from './controllers/collaboration.controller';
import { CollaborationIntegrationService } from './integration/collaboration-integration.service';

/**
 * Module for real-time collaboration features including shared documents,
 * whiteboards, version control, and permission management
 */
@Module({
  controllers: [CollaborationController],
  providers: [
    CollaborationService,
    SharedDocumentService,
    WhiteboardService,
    VersionControlService,
    CollaborationPermissionsService,
    ConflictResolutionService,
    CollaborationIntegrationService,
  ],
  exports: [
    CollaborationService,
    SharedDocumentService,
    WhiteboardService,
    VersionControlService,
    CollaborationPermissionsService,
    ConflictResolutionService,
    CollaborationIntegrationService,
  ],
})
export class CollaborationModule {}