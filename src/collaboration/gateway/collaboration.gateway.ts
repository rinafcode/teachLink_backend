import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { CollaborationService } from '../collaboration.service';
import { SharedDocumentService } from '../documents/shared-document.service';
import { WhiteboardService } from '../whiteboard/whiteboard.service';
import { VersionControlService } from '../versioning/version-control.service';
import { CollaborationPermissionsService, PermissionLevel } from '../permissions/collaboration-permissions.service';

export interface CollaborativeOperation {
  sessionId: string;
  userId: string;
  resourceType: 'document' | 'whiteboard';
  operation: any;
  timestamp: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class CollaborationGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('CollaborationGateway');

  constructor(
    private readonly collaborationService: CollaborationService,
    private readonly sharedDocumentService: SharedDocumentService,
    private readonly whiteboardService: WhiteboardService,
    private readonly versionControlService: VersionControlService,
    private readonly permissionsService: CollaborationPermissionsService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Collaboration Gateway initialized');
  }

  async handleConnection(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    // Optionally authenticate the user here based on token
    // const token = client.handshake.auth.token;
    // const user = await this.authService.validateToken(token);
  }

  async handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Clean up any session associations for this client
    // Remove client from any active sessions
  }

  @SubscribeMessage('join-session')
  async handleJoinSession(
    @MessageBody() data: { sessionId: string; userId: string; resourceType: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId, userId, resourceType } = data;

    try {
      // Check permissions
      const hasPermission = await this.permissionsService.hasAccess(sessionId, userId);
      if (!hasPermission) {
        client.emit('error', { message: 'Insufficient permissions to join session' });
        return;
      }

      // Join the room
      client.join(sessionId);
      
      // Initialize or get the resource
      let resource: any;
      if (resourceType === 'document') {
        resource = await this.sharedDocumentService.getDocument(sessionId);
        if (!resource) {
          resource = await this.collaborationService.initializeSession(sessionId, userId, 'document' as any);
        }
      } else if (resourceType === 'whiteboard') {
        resource = await this.whiteboardService.getWhiteboard(sessionId);
        if (!resource) {
          resource = await this.collaborationService.initializeSession(sessionId, userId, 'whiteboard' as any);
        }
      }

      // Notify other users in the session
      client.to(sessionId).emit('user-joined', { userId, sessionId });

      // Send current resource state to the joining user
      client.emit('session-state', {
        sessionId,
        resourceType,
        resource,
        collaborators: await this.permissionsService.getUsersForResource(sessionId),
      });

      this.logger.log(`User ${userId} joined session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error joining session: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('collaborative-operation')
  async handleCollaborativeOperation(
    @MessageBody() operation: CollaborativeOperation,
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId, userId, resourceType, operation: opData } = operation;

    try {
      // Validate permissions
      const hasPermission = await this.permissionsService.hasAccess(
        sessionId, 
        userId, 
        resourceType === 'document' ? PermissionLevel.WRITE : PermissionLevel.WRITE
      );
      
      if (!hasPermission) {
        client.emit('error', { message: 'Insufficient permissions to perform operation' });
        return;
      }

      // Process the operation based on resource type
      let result: any;
      if (resourceType === 'document') {
        result = await this.sharedDocumentService.applyOperation(sessionId, userId, opData);
      } else if (resourceType === 'whiteboard') {
        result = await this.whiteboardService.applyOperation(sessionId, userId, opData);
      }

      // Record the change for version control
      await this.collaborationService.trackChange(sessionId, userId, {
        operation: opData,
        resourceType,
        result,
      });

      // Broadcast the operation to all other clients in the session
      client.to(sessionId).emit('operation-applied', {
        operation: opData,
        userId,
        timestamp: Date.now(),
        result,
      });

      this.logger.log(`Operation applied in session ${sessionId} by user ${userId}`);
    } catch (error) {
      this.logger.error(`Error applying operation: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('request-sync')
  async handleSyncRequest(
    @MessageBody() data: { sessionId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId, userId } = data;

    try {
      const hasPermission = await this.permissionsService.hasAccess(sessionId, userId);
      if (!hasPermission) {
        client.emit('error', { message: 'Insufficient permissions to sync' });
        return;
      }

      // Send current state to requesting client
      const document = await this.sharedDocumentService.getDocument(sessionId);
      const whiteboard = await this.whiteboardService.getWhiteboard(sessionId);
      
      client.emit('full-sync', {
        sessionId,
        document: document || null,
        whiteboard: whiteboard || null,
      });
    } catch (error) {
      this.logger.error(`Error syncing state: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('resolve-conflict')
  async handleConflictResolution(
    @MessageBody() data: { sessionId: string; userId: string; resourceType: string; operations: any[] },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId, userId, resourceType, operations } = data;

    try {
      // Only admins/owners can resolve conflicts
      const hasPermission = await this.permissionsService.hasAccess(sessionId, userId, PermissionLevel.ADMIN);
      if (!hasPermission) {
        client.emit('error', { message: 'Insufficient permissions to resolve conflicts' });
        return;
      }

      let result: any;
      if (resourceType === 'document') {
        result = await this.sharedDocumentService.resolveConflicts(sessionId, operations);
      } else if (resourceType === 'whiteboard') {
        result = await this.whiteboardService.resolveConflicts(sessionId, operations);
      }

      // Broadcast resolved state to all clients
      this.server.to(sessionId).emit('conflict-resolved', {
        sessionId,
        resourceType,
        resolvedState: result,
      });

      this.logger.log(`Conflict resolved in session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error resolving conflict: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  // Method to broadcast to a specific session
  broadcastToSession(sessionId: string, event: string, data: any) {
    this.server.to(sessionId).emit(event, data);
  }
}