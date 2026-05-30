import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { CreateMessageDto } from './message.dto';

@WebSocketGateway({ namespace: 'messages', cors: true })
export class MessageGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessageGateway.name);

  constructor(private readonly messagingService: MessagingService) {}

  // When a client connects, place them in a room named after their userId (passed via query param `userId`)
  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.join(userId);
      this.logger.log(`User ${userId} connected to WebSocket`);
    } else {
      this.logger.warn('WebSocket connection without userId');
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.leave(userId);
      this.logger.log(`User ${userId} disconnected from WebSocket`);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(@MessageBody() dto: CreateMessageDto, @ConnectedSocket() client: Socket) {
    // Persist the message
    const savedMessage = await this.messagingService.createMessage(dto);
    // Emit to recipient's room
    this.server.to(dto.recipientId).emit('message', savedMessage);
    // Also emit back to sender for acknowledgment
    client.emit('message', savedMessage);
    return savedMessage;
  }

  @SubscribeMessage('typing')
  handleTyping(@MessageBody() payload: { recipientId: string }, @ConnectedSocket() client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.server.to(payload.recipientId).emit('typing', { from: userId });
    }
  }
}
