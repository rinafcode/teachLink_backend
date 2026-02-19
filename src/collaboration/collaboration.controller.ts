import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { CollaborationService } from './collaboration.service';
import { SharedDocumentService, CollaborativeDocument } from './documents/shared-document.service';
import { WhiteboardService, CollaborativeWhiteboard } from './whiteboard/whiteboard.service';
import { VersionControlService } from './versioning/version-control.service';
import { CollaborationPermissionsService } from './permissions/collaboration-permissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionLevel } from './permissions/collaboration-permissions.service';

@Controller('collaboration')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CollaborationController {
  constructor(
    private readonly collaborationService: CollaborationService,
    private readonly sharedDocumentService: SharedDocumentService,
    private readonly whiteboardService: WhiteboardService,
    private readonly versionControlService: VersionControlService,
    private readonly permissionsService: CollaborationPermissionsService,
  ) {}

  /**
   * Initialize a new collaborative session
   */
  @Post('session')
  async createSession(
    @Request() req,
    @Body() body: { sessionId: string; resourceType: 'document' | 'whiteboard' }
  ) {
    const { sessionId, resourceType } = body;
    const userId = req.user.id;

    const session = await this.collaborationService.initializeSession(sessionId, userId, resourceType);
    
    return {
      success: true,
      sessionId,
      resourceType,
      session,
    };
  }

  /**
   * Get collaborative document
   */
  @Get('document/:id')
  async getDocument(@Param('id') documentId: string, @Request() req) {
    const userId = req.user.id;
    const hasPermission = await this.permissionsService.hasAccess(documentId, userId, PermissionLevel.READ);
    
    if (!hasPermission) {
      return { success: false, message: 'Insufficient permissions to access document' };
    }

    const document = await this.sharedDocumentService.getDocument(documentId);
    
    return {
      success: true,
      document,
    };
  }

  /**
   * Get collaborative whiteboard
   */
  @Get('whiteboard/:id')
  async getWhiteboard(@Param('id') whiteboardId: string, @Request() req) {
    const userId = req.user.id;
    const hasPermission = await this.permissionsService.hasAccess(whiteboardId, userId, PermissionLevel.READ);
    
    if (!hasPermission) {
      return { success: false, message: 'Insufficient permissions to access whiteboard' };
    }

    const whiteboard = await this.whiteboardService.getWhiteboard(whiteboardId);
    
    return {
      success: true,
      whiteboard,
    };
  }

  /**
   * Update collaborative document
   */
  @Put('document/:id')
  async updateDocument(
    @Param('id') documentId: string,
    @Request() req,
    @Body() body: { operation: any }
  ) {
    const { operation } = body;
    const userId = req.user.id;
    const hasPermission = await this.permissionsService.hasAccess(documentId, userId, PermissionLevel.WRITE);
    
    if (!hasPermission) {
      return { success: false, message: 'Insufficient permissions to modify document' };
    }

    const document = await this.sharedDocumentService.applyOperation(
      documentId,
      userId,
      operation
    );
    
    return {
      success: true,
      document,
    };
  }

  /**
   * Update collaborative whiteboard
   */
  @Put('whiteboard/:id')
  async updateWhiteboard(
    @Param('id') whiteboardId: string,
    @Request() req,
    @Body() body: { operation: any }
  ) {
    const { operation } = body;
    const userId = req.user.id;
    const hasPermission = await this.permissionsService.hasAccess(whiteboardId, userId, PermissionLevel.WRITE);
    
    if (!hasPermission) {
      return { success: false, message: 'Insufficient permissions to modify whiteboard' };
    }

    const whiteboard = await this.whiteboardService.applyOperation(
      whiteboardId,
      userId,
      operation
    );
    
    return {
      success: true,
      whiteboard,
    };
  }

  /**
   * Get document history
   */
  @Get('document/:id/history')
  async getDocumentHistory(@Param('id') documentId: string, @Request() req) {
    const userId = req.user.id;
    const hasPermission = await this.permissionsService.hasAccess(documentId, userId, PermissionLevel.READ);
    
    if (!hasPermission) {
      return { success: false, message: 'Insufficient permissions to access history' };
    }

    const history = await this.sharedDocumentService.getDocumentHistory(documentId);
    
    return {
      success: true,
      history,
    };
  }

  /**
   * Get whiteboard history
   */
  @Get('whiteboard/:id/history')
  async getWhiteboardHistory(@Param('id') whiteboardId: string, @Request() req) {
    const userId = req.user.id;
    const hasPermission = await this.permissionsService.hasAccess(whiteboardId, userId, PermissionLevel.READ);
    
    if (!hasPermission) {
      return { success: false, message: 'Insufficient permissions to access history' };
    }

    const history = await this.whiteboardService.getWhiteboardHistory(whiteboardId);
    
    return {
      success: true,
      history,
    };
  }

  /**
   * Get version history for a session
   */
  @Get('version-history/:sessionId')
  async getVersionHistory(@Param('sessionId') sessionId: string, @Request() req) {
    const userId = req.user.id;
    const hasPermission = await this.permissionsService.hasAccess(sessionId, userId, PermissionLevel.READ);
    
    if (!hasPermission) {
      return { success: false, message: 'Insufficient permissions to access version history' };
    }

    const history = await this.versionControlService.getVersionHistory(sessionId);
    
    return {
      success: true,
      history,
    };
  }

  /**
   * Get current version of a session
   */
  @Get('version-current/:sessionId')
  async getCurrentVersion(@Param('sessionId') sessionId: string, @Request() req) {
    const userId = req.user.id;
    const hasPermission = await this.permissionsService.hasAccess(sessionId, userId, PermissionLevel.READ);
    
    if (!hasPermission) {
      return { success: false, message: 'Insufficient permissions to access current version' };
    }

    const currentVersion = await this.versionControlService.getCurrentVersion(sessionId);
    
    return {
      success: true,
      currentVersion,
    };
  }

  /**
   * Grant permissions to a user
   */
  @Post('permission/:resourceId/user/:userId')
  async grantPermission(
    @Param('resourceId') resourceId: string,
    @Param('userId') userId: string,
    @Request() req,
    @Body() body: { permission: PermissionLevel }
  ) {
    const adminUserId = req.user.id;
    const { permission } = body;
    
    // Check if the requesting user has admin permissions
    const isAdmin = await this.permissionsService.hasAccess(resourceId, adminUserId, PermissionLevel.ADMIN);
    
    if (!isAdmin) {
      return { success: false, message: 'Insufficient permissions to grant permissions' };
    }

    const grantedPermission = await this.permissionsService.grantAccess(resourceId, userId, permission, adminUserId);
    
    return {
      success: true,
      permission: grantedPermission,
    };
  }

  /**
   * Revoke permissions from a user
   */
  @Delete('permission/:resourceId/user/:userId')
  async revokePermission(
    @Param('resourceId') resourceId: string,
    @Param('userId') userId: string,
    @Request() req
  ) {
    const adminUserId = req.user.id;
    
    // Check if the requesting user has admin permissions
    const isAdmin = await this.permissionsService.hasAccess(resourceId, adminUserId, PermissionLevel.ADMIN);
    
    if (!isAdmin) {
      return { success: false, message: 'Insufficient permissions to revoke permissions' };
    }

    const revoked = await this.permissionsService.revokeAccess(resourceId, userId);
    
    return {
      success: true,
      revoked,
    };
  }

  /**
   * Get users with access to a resource
   */
  @Get('users/:resourceId')
  async getUsersForResource(@Param('resourceId') resourceId: string, @Request() req) {
    const userId = req.user.id;
    const hasPermission = await this.permissionsService.hasAccess(resourceId, userId, PermissionLevel.READ);
    
    if (!hasPermission) {
      return { success: false, message: 'Insufficient permissions to view resource users' };
    }

    const users = await this.permissionsService.getUsersForResource(resourceId);
    
    return {
      success: true,
      users,
    };
  }
}