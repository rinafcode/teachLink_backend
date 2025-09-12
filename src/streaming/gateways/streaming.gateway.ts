import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/streaming',
})
export class StreamingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('StreamingGateway');

  afterInit(server: Server) {
    this.logger.log('StreamingGateway initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() data: { roomId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.roomId);
    client
      .to(data.roomId)
      .emit('userJoined', { userId: data.userId, socketId: client.id });
    this.logger.log(`User ${data.userId} joined room ${data.roomId}`);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() data: { roomId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(data.roomId);
    client
      .to(data.roomId)
      .emit('userLeft', { userId: data.userId, socketId: client.id });
    this.logger.log(`User ${data.userId} left room ${data.roomId}`);
  }

  @SubscribeMessage('sendMessage')
  handleMessage(
    @MessageBody() data: { roomId: string; message: any },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(data.roomId).emit('newMessage', data.message);
  }

  @SubscribeMessage('videoOffer')
  handleVideoOffer(
    @MessageBody() data: { roomId: string; offer: any; to: string },
    @ConnectedSocket() client: Socket,
  ) {
    client
      .to(data.to)
      .emit('videoOffer', { offer: data.offer, from: client.id });
  }

  @SubscribeMessage('videoAnswer')
  handleVideoAnswer(
    @MessageBody() data: { roomId: string; answer: any; to: string },
    @ConnectedSocket() client: Socket,
  ) {
    client
      .to(data.to)
      .emit('videoAnswer', { answer: data.answer, from: client.id });
  }

  @SubscribeMessage('iceCandidate')
  handleIceCandidate(
    @MessageBody() data: { roomId: string; candidate: any; to: string },
    @ConnectedSocket() client: Socket,
  ) {
    client
      .to(data.to)
      .emit('iceCandidate', { candidate: data.candidate, from: client.id });
  }

  // Method to send notifications to specific users
  sendNotificationToUser(userId: string, notification: any) {
    this.server.emit('notification', { userId, ...notification });
  }

  // Method to broadcast to a room
  broadcastToRoom(roomId: string, event: string, data: any) {
    this.server.to(roomId).emit(event, data);
  }
}
