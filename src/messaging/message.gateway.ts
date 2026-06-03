import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { CreateMessageDto } from './message.dto';
import { ConnectionSessionService } from './websocket-resilience/connection-session.service';
import { WebSocketResilienceService } from './websocket-resilience/websocket-resilience.service';

@WebSocketGateway({ namespace: 'messages', cors: true })
export class MessageGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessageGateway.name);

  constructor(
    private readonly messagingService: MessagingService,
    private readonly sessionService: ConnectionSessionService,
    private readonly resilienceService: WebSocketResilienceService,
  ) {}

  afterInit(): void {
    this.resilienceService.startHeartbeat(this.server);
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    const lastSeq = parseInt((client.handshake.query.lastSeq as string) || '0', 10);
    if (userId) {
      client.join(userId);
      this.sessionService.register(userId, client.id);
      this.resilienceService.replayPending(this.server, client.id, lastSeq);
      client.emit('connected', {
        userId,
        reconnectDelayMs: this.resilienceService.getReconnectDelay(0),
      });
      this.logger.log(`User ${userId} connected (lastSeq=${lastSeq})`);
    } else {
      this.logger.warn('WebSocket connection without userId');
    }
  }

  handleDisconnect(client: Socket) {
    const session = this.sessionService.unregister(client.id);
    if (session) {
      client.leave(session.userId);
      this.logger.log(`User ${session.userId} disconnected`);
    }
  }

  @SubscribeMessage('pong')
  handlePong(@ConnectedSocket() client: Socket) {
    this.sessionService.recordPong(client.id);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { ts: Date.now() });
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(@MessageBody() dto: CreateMessageDto, @ConnectedSocket() client: Socket) {
    const savedMessage = await this.messagingService.createMessage(dto);
    this.resilienceService.emitOrQueue(this.server, dto.recipientId, 'message', savedMessage);
    client.emit('message', savedMessage);
    return savedMessage;
  }

  @SubscribeMessage('typing')
  handleTyping(@MessageBody() payload: { recipientId: string }, @ConnectedSocket() client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.resilienceService.emitOrQueue(this.server, payload.recipientId, 'typing', { from: userId });
    }
  }
}
