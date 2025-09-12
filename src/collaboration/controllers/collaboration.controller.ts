import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CollaborationService } from '../collaboration.service';
import { SharedDocumentService } from '../documents/shared-document.service';
import { WhiteboardService } from '../whiteboard/whiteboard.service';
import { VersionControlService } from '../versioning/version-control.service';
import { CollaborationPermissionsService } from '../permissions/collaboration-permissions.service';
import { ConflictResolutionService } from '../conflict/conflict-resolution.service';

@Controller('collaboration')
export class CollaborationController {
  constructor(
    private readonly collaborationService: CollaborationService,
    private readonly sharedDocumentService: SharedDocumentService,
    private readonly whiteboardService: WhiteboardService,
    private readonly versionControlService: VersionControlService,
    private readonly permissionsService: CollaborationPermissionsService,
    private readonly conflictResolutionService: ConflictResolutionService,
  ) {}

  // Collaboration Sessions
  
  @Post('sessions')
  async createSession(@Body() data: { name: string; type: string; ownerId: string }) {
    return this.collaborationService.createSession(data.name, data.type, data.ownerId);
  }

  @Get('sessions')
  async getSessions() {
    return this.collaborationService.getAllSessions();
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    return this.collaborationService.getSessionInfo(id);
  }

  @Post('sessions/:id/join')
  async joinSession(@Param('id') id: string, @Body() data: { userId: string }) {
    return this.collaborationService.joinSession(id, data.userId);
  }

  @Post('sessions/:id/leave')
  async leaveSession(@Param('id') id: string, @Body() data: { userId: string }) {
    return this.collaborationService.leaveSession(id, data.userId);
  }

  @Delete('sessions/:id')
  async closeSession(@Param('id') id: string) {
    return this.collaborationService.closeSession(id);
  }

  @Get('sessions/:id/participants')
  async getParticipants(@Param('id') id: string) {
    return this.collaborationService.getActiveParticipants(id);
  }

  // Shared Documents

  @Post('documents')
  async createDocument(@Body() data: { name: string; content: string; ownerId: string }) {
    return this.sharedDocumentService.createDocument(data.name, data.content, data.ownerId);
  }

  @Get('documents/:id')
  async getDocument(@Param('id') id: string) {
    return this.sharedDocumentService.getDocument(id);
  }

  @Post('documents/:id/operations')
  async applyDocumentOperation(
    @Param('id') id: string,
    @Body() data: { userId: string; operations: any[] },
  ) {
    return this.sharedDocumentService.applyOperation(id, {
      id: `op-${Date.now()}`,
      userId: data.userId,
      documentId: id,
      timestamp: Date.now(),
      version: 0, // The service will handle versioning
      operations: data.operations,
    });
  }

  @Get('documents/:id/history')
  async getDocumentHistory(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.sharedDocumentService.getOperationHistory(id, limit, offset);
  }

  // Whiteboards

  @Post('whiteboards')
  async createWhiteboard(@Body() data: { name: string; ownerId: string }) {
    return this.whiteboardService.createWhiteboard(data.name, data.ownerId);
  }

  @Get('whiteboards/:id')
  async getWhiteboard(@Param('id') id: string) {
    return this.whiteboardService.getWhiteboard(id);
  }

  @Post('whiteboards/:id/operations')
  async applyWhiteboardOperation(
    @Param('id') id: string,
    @Body() data: { userId: string; type: string; elements: any[] },
  ) {
    return this.whiteboardService.applyOperation(id, {
      id: `op-${Date.now()}`,
      type: data.type,
      userId: data.userId,
      whiteboardId: id,
      timestamp: Date.now(),
      version: 0, // The service will handle versioning
      elements: data.elements,
    });
  }

  @Get('whiteboards/:id/history')
  async getWhiteboardHistory(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.whiteboardService.getOperationHistory(id, limit, offset);
  }

  // Version Control

  @Post('versions/:resourceType/:resourceId')
  async createVersion(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Body() data: { name: string; userId: string },
  ) {
    return this.versionControlService.createVersion(resourceType, resourceId, data.name, data.userId);
  }

  @Get('versions/:resourceType/:resourceId')
  async getVersions(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.versionControlService.getVersions(resourceType, resourceId);
  }

  @Get('versions/:versionId')
  async getVersionDetails(@Param('versionId') versionId: string) {
    return this.versionControlService.getVersion(versionId);
  }

  @Post('versions/compare')
  async compareVersions(
    @Body() data: { versionA: string; versionB: string },
  ) {
    return this.versionControlService.compareVersions(data.versionA, data.versionB);
  }

  @Post('versions/:versionId/revert')
  async revertToVersion(
    @Param('versionId') versionId: string,
    @Body() data: { userId: string },
  ) {
    return this.versionControlService.revertToVersion(versionId, data.userId);
  }

  // Branches

  @Post('branches/:resourceType/:resourceId')
  async createBranch(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Body() data: { name: string; userId: string },
  ) {
    return this.versionControlService.createBranch(resourceType, resourceId, data.name, data.userId);
  }

  @Get('branches/:resourceType/:resourceId')
  async getBranches(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.versionControlService.getBranches(resourceType, resourceId);
  }

  @Post('branches/:branchId/merge')
  async mergeBranch(
    @Param('branchId') branchId: string,
    @Body() data: { targetBranchId: string; userId: string },
  ) {
    return this.versionControlService.mergeBranches(branchId, data.targetBranchId, data.userId);
  }

  // Permissions

  @Post('permissions/:resourceType/:resourceId/user')
  async grantUserPermission(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Body() data: { userId: string; level: string },
  ) {
    return this.permissionsService.grantUserPermission(
      resourceType,
      resourceId,
      data.userId,
      data.level as any,
    );
  }

  @Delete('permissions/:resourceType/:resourceId/user/:userId')
  async revokeUserPermission(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Param('userId') userId: string,
  ) {
    return this.permissionsService.revokeUserPermission(resourceType, resourceId, userId);
  }

  @Get('permissions/:resourceType/:resourceId')
  async getResourcePermissions(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.permissionsService.getResourcePermissions(resourceType, resourceId);
  }

  @Post('permissions/groups')
  async createPermissionGroup(@Body() data: { name: string; ownerId: string }) {
    return this.permissionsService.createPermissionGroup(data.name, data.ownerId);
  }

  @Post('permissions/groups/:groupId/members')
  async addGroupMember(
    @Param('groupId') groupId: string,
    @Body() data: { userId: string },
  ) {
    return this.permissionsService.addGroupMember(groupId, data.userId);
  }

  @Delete('permissions/groups/:groupId/members/:userId')
  async removeGroupMember(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    return this.permissionsService.removeGroupMember(groupId, userId);
  }

  // Conflict Resolution

  @Get('conflicts/:resourceType/:resourceId')
  async getConflicts(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Query('includeResolved') includeResolved?: boolean,
  ) {
    return this.conflictResolutionService.getConflicts(
      resourceId,
      resourceType as any,
      includeResolved,
    );
  }

  @Get('conflicts/strategies')
  async getConflictStrategies() {
    return this.conflictResolutionService.getAvailableStrategies();
  }

  @Post('conflicts/:conflictId/resolve')
  async resolveConflict(
    @Param('conflictId') conflictId: string,
    @Body() data: { strategyName: string; userId: string },
  ) {
    return this.conflictResolutionService.manuallyResolveConflict(
      conflictId,
      data.strategyName,
      data.userId,
    );
  }
}