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
import { COLLABORATION_EVENTS } from '../constants/collaboration-events.constants';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { CollaborationService } from '../collaboration.service';
import { WsThrottlerGuard } from '../../common/guards/ws-throttler.guard';
import { SharedDocumentService } from '../documents/shared-document.service';
import { WhiteboardService } from '../whiteboard/whiteboard.service';
import { VersionControlService } from '../versioning/version-control.service';
import {
  CollaborationPermissionsService,
  PermissionLevel,
} from '../permissions/collaboration-permissions.service';
import { wsManager } from '../../common/utils/websocket.utils';

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
@UseGuards(WsThrottlerGuard)
export class CollaborationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('CollaborationGateway');

  constructor(
    private readonly collaborationService: CollaborationService,
    private readonly sharedDocumentService: SharedDocumentService,
    private readonly whiteboardService: WhiteboardService,
    private readonly versionControlService: VersionControlService,
    private readonly permissionsService: CollaborationPermissionsService,
  ) {}

  afterInit(_server: Server): void {
    this.logger.log('Collaboration Gateway initialized');
  }

  async handleConnection(_server: any, @ConnectedSocket() client: Socket): Promise<void> {
    if (wsManager.getTotalConnections() >= 5000) {
      client.emit('error', { message: 'Server is at maximum capacity' });
      client.disconnect(true);
      return;
    }
    this.logger.log(`Client connected: ${client.id}`);

    // Optionally authenticate the user here based on token
    // const token = client.handshake.auth.token;
    // const user = await this.authService.validateToken(token);
  }

  async handleDisconnect(@ConnectedSocket() client: Socket): Promise<void> {
    wsManager.cleanupSocket(client);
    this.logger.log(`Client disconnected: ${client.id}`);

    // Clean up any session associations for this client
    // Remove client from any active sessions
  }

  @SubscribeMessage(COLLABORATION_EVENTS.JOIN_SESSION)
  async handleJoinSession(
    @MessageBody() data: { sessionId: string; userId: string; resourceType: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const { sessionId, userId, resourceType } = data;

    try {
      // Check permissions
      const hasPermission = await this.permissionsService.hasAccess(sessionId, userId);
      if (!hasPermission) {
        client.emit('error', { message: 'Insufficient permissions to join session' });
        return;
      }

      const registered = wsManager.registerConnection(userId, client);
      if (!registered) {
        client.emit('error', { message: 'Connection limit reached' });
        return;
      }

      // Join the room
      client.join(sessionId);

      // Initialize or get the resource
      let resource: any;
      if (resourceType === 'document') {
        resource = await this.sharedDocumentService.getDocument(sessionId);
        if (!resource) {
          resource = await this.collaborationService.initializeSession(
            sessionId,
            userId,
            'document' as any,
          );
        }
      } else if (resourceType === 'whiteboard') {
        resource = await this.whiteboardService.getWhiteboard(sessionId);
        if (!resource) {
          resource = await this.collaborationService.initializeSession(
            sessionId,
            userId,
            'whiteboard' as any,
          );
        }
      }

      // Notify other users in the session
      client.to(sessionId).emit(COLLABORATION_EVENTS.USER_JOINED, { userId, sessionId });

      // Send current resource state to the joining user
      client.emit(COLLABORATION_EVENTS.SESSION_STATE, {
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

  @SubscribeMessage(COLLABORATION_EVENTS.COLLABORATIVE_OPERATION)
  async handleCollaborativeOperation(
    @MessageBody() operation: CollaborativeOperation,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const { sessionId, userId, resourceType, operation: opData } = operation;

    try {
      // Validate permissions
      const hasPermission = await this.permissionsService.hasAccess(
        sessionId,
        userId,
        resourceType === 'document' ? PermissionLevel.WRITE : PermissionLevel.WRITE,
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
      client.to(sessionId).emit(COLLABORATION_EVENTS.OPERATION_APPLIED, {
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

  @SubscribeMessage(COLLABORATION_EVENTS.REQUEST_SYNC)
  async handleSyncRequest(
    @MessageBody() data: { sessionId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
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

      client.emit(COLLABORATION_EVENTS.FULL_SYNC, {
        sessionId,
        document: document || null,
        whiteboard: whiteboard || null,
      });
    } catch (error) {
      this.logger.error(`Error syncing state: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage(COLLABORATION_EVENTS.RESOLVE_CONFLICT)
  async handleConflictResolution(
    @MessageBody()
    data: { sessionId: string; userId: string; resourceType: string; operations: any[] },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const { sessionId, userId, resourceType, operations } = data;

    try {
      // Only admins/owners can resolve conflicts
      const hasPermission = await this.permissionsService.hasAccess(
        sessionId,
        userId,
        PermissionLevel.ADMIN,
      );
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
      this.server.to(sessionId).emit(COLLABORATION_EVENTS.CONFLICT_RESOLVED, {
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
  broadcastToSession(sessionId: string, event: string, data: any): void {
    this.server.to(sessionId).emit(event, data);
  }
}
