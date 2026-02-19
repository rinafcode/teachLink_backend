import { Injectable } from '@nestjs/common';
import { SharedDocumentService } from './documents/shared-document.service';
import { WhiteboardService } from './whiteboard/whiteboard.service';
import { VersionControlService } from './versioning/version-control.service';
import { CollaborationPermissionsService } from './permissions/collaboration-permissions.service';

@Injectable()
export class CollaborationService {
  constructor(
    private readonly sharedDocumentService: SharedDocumentService,
    private readonly whiteboardService: WhiteboardService,
    private readonly versionControlService: VersionControlService,
    private readonly permissionsService: CollaborationPermissionsService,
  ) {}

  /**
   * Initialize a new collaborative session
   */
  async initializeSession(sessionId: string, userId: string, resourceType: 'document' | 'whiteboard') {
    // Set up initial permissions and session tracking
    await this.permissionsService.grantAccess(sessionId, userId);
    
    if (resourceType === 'document') {
      return await this.sharedDocumentService.initializeDocument(sessionId);
    } else if (resourceType === 'whiteboard') {
      return await this.whiteboardService.initializeWhiteboard(sessionId);
    }
    
    throw new Error(`Unsupported resource type: ${resourceType}`);
  }

  /**
   * Handle incoming collaborative changes
   */
  async handleCollaborativeChange(
    sessionId: string,
    userId: string,
    operation: any,
    resourceType: 'document' | 'whiteboard'
  ) {
    // Check permissions
    const hasPermission = await this.permissionsService.hasAccess(sessionId, userId);
    if (!hasPermission) {
      throw new Error('User does not have permission to modify this resource');
    }

    if (resourceType === 'document') {
      return await this.sharedDocumentService.applyOperation(sessionId, userId, operation);
    } else if (resourceType === 'whiteboard') {
      return await this.whiteboardService.applyOperation(sessionId, userId, operation);
    }
    
    throw new Error(`Unsupported resource type: ${resourceType}`);
  }

  /**
   * Track changes for version control
   */
  async trackChange(sessionId: string, userId: string, change: any) {
    return await this.versionControlService.recordChange(sessionId, userId, change);
  }
}