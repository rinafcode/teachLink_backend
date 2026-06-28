import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { COLLABORATION_EVENTS } from './constants/collaboration-events.constants';
import { JoinSessionDto, CollaborativeOperationDto, SyncRequestDto } from './dto/websocket.dto';
import { OtCrdtService, Operation } from './ot-crdt.service';
import { PresenceService } from './presence.service';
import { ChangeHistoryService } from './change-history.service';
import { WsPayloadSizeGuardService } from './guards/ws-payload-size-guard.service';

@WebSocketGateway({ namespace: '/collaboration', cors: { origin: '*' } })
export class CollaborationGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CollaborationGateway.name);
  // socketId -> { sessionId, userId }
  private readonly socketMap = new Map<string, { sessionId: string; userId: string }>();

  constructor(
    private readonly otCrdt: OtCrdtService,
    private readonly presence: PresenceService,
    private readonly history: ChangeHistoryService,
    private readonly payloadSizeGuard: WsPayloadSizeGuardService,
  ) {}

  handleDisconnect(client: Socket): void {
    const info = this.socketMap.get(client.id);
    if (info) {
      this.presence.leave(info.sessionId, info.userId);
      this.socketMap.delete(client.id);
      this.server.to(info.sessionId).emit(COLLABORATION_EVENTS.USER_JOINED, {
        userId: info.userId,
        event: 'left',
        presence: this.presence.getPresence(info.sessionId),
      });
    }
  }

  @SubscribeMessage(COLLABORATION_EVENTS.JOIN_SESSION)
  handleJoin(@MessageBody() dto: JoinSessionDto, @ConnectedSocket() client: Socket) {
    this.payloadSizeGuard.validate(dto);

    client.join(dto.sessionId);
    this.socketMap.set(client.id, { sessionId: dto.sessionId, userId: dto.userId });
    const presenceInfo = this.presence.join(dto.sessionId, dto.userId);

    this.server.to(dto.sessionId).emit(COLLABORATION_EVENTS.USER_JOINED, {
      userId: dto.userId,
      event: 'joined',
      presence: this.presence.getPresence(dto.sessionId),
    });

    return {
      event: COLLABORATION_EVENTS.SESSION_STATE,
      data: {
        sessionId: dto.sessionId,
        revision: this.otCrdt.currentRevision(dto.sessionId),
        presence: this.presence.getPresence(dto.sessionId),
        presenceInfo,
      },
    };
  }

  @SubscribeMessage(COLLABORATION_EVENTS.COLLABORATIVE_OPERATION)
  handleOperation(
    @MessageBody() dto: CollaborativeOperationDto,
    @ConnectedSocket() client: Socket,
  ) {
    this.payloadSizeGuard.validate(dto);

    const incomingOp = dto.operation as Operation;
    const revision = this.otCrdt.nextRevision(dto.sessionId);
    const op: Operation = { ...incomingOp, sessionId: dto.sessionId, userId: dto.userId, revision };

    // Transform against any concurrent ops at the same revision
    const concurrent = this.history
      .getHistory(dto.sessionId, revision - 1)
      .filter((e) => e.revision === revision && e.operation.userId !== dto.userId);

    let finalOp = op;
    for (const entry of concurrent) {
      const result = this.otCrdt.transform(finalOp, entry.operation);
      finalOp = result.operation;
    }

    this.history.record(finalOp);

    // Broadcast to all other clients in the session
    client.to(dto.sessionId).emit(COLLABORATION_EVENTS.OPERATION_APPLIED, {
      operation: finalOp,
      revision,
    });

    return {
      event: COLLABORATION_EVENTS.OPERATION_APPLIED,
      data: { operation: finalOp, revision },
    };
  }

  @SubscribeMessage(COLLABORATION_EVENTS.REQUEST_SYNC)
  handleSync(@MessageBody() dto: SyncRequestDto) {
    this.payloadSizeGuard.validate(dto);

    const revision = this.otCrdt.currentRevision(dto.sessionId);
    const history = this.history.getLatest(dto.sessionId);

    return {
      event: COLLABORATION_EVENTS.FULL_SYNC,
      data: { sessionId: dto.sessionId, revision, history },
    };
  }

  @SubscribeMessage(COLLABORATION_EVENTS.RESOLVE_CONFLICT)
  handleConflict(@MessageBody() body: { op1: Operation; op2: Operation; sessionId: string }) {
    this.payloadSizeGuard.validate(body);

    const resolved = this.otCrdt.resolveConflict(body.op1, body.op2);
    this.server.to(body.sessionId).emit(COLLABORATION_EVENTS.CONFLICT_RESOLVED, { resolved });
    return { event: COLLABORATION_EVENTS.CONFLICT_RESOLVED, data: { resolved } };
  }
}
