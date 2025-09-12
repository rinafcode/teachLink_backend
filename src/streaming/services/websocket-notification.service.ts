import { Injectable } from '@nestjs/common';
import type { StreamingGateway } from '../gateways/streaming.gateway';

@Injectable()
export class WebSocketNotificationService {
  constructor(private readonly streamingGateway: StreamingGateway) {}

  async notifyRoomStatusChange(roomId: string, status: string) {
    await this.streamingGateway.broadcastToRoom(roomId, 'room-status-changed', {
      roomId,
      status,
      timestamp: new Date(),
    });
  }

  async notifyRecordingStarted(roomId: string, startedBy: any) {
    await this.streamingGateway.broadcastToRoom(roomId, 'recording-started', {
      roomId,
      startedBy,
      startedAt: new Date(),
    });
  }

  async notifyRecordingCompleted(
    roomId: string,
    recordingId: string,
    duration: number,
  ) {
    await this.streamingGateway.broadcastToRoom(roomId, 'recording-completed', {
      roomId,
      recordingId,
      duration,
      completedAt: new Date(),
    });
  }

  async notifyStreamHealthUpdate(roomId: string, healthData: any) {
    await this.streamingGateway.broadcastToRoom(roomId, 'stream-health-update', {
      roomId,
      ...healthData,
      timestamp: new Date(),
    });
  }

  async notifyParticipantRoleChanged(
    roomId: string,
    userId: string,
    newRole: string,
    changedBy: string,
  ) {
    await this.streamingGateway.broadcastToRoom(roomId, 'participant-role-changed', {
      userId,
      newRole,
      changedBy,
      timestamp: new Date(),
    });
  }

  async notifySystemMessage(roomId: string, message: string, metadata?: any) {
    await this.streamingGateway.broadcastToRoom(roomId, 'system-message', {
      message,
      metadata,
      timestamp: new Date(),
    });
  }

  async notifyUserDirectly(userId: string, event: string, data: any) {
    this.streamingGateway.sendNotificationToUser(userId, { event, data });
  }

  async getRoomParticipantCount(roomId: string): Promise<number> {
    return 0; // Placeholder: not tracked in gateway
  }

  async isUserInRoom(userId: string, roomId: string): Promise<boolean> {
    return false; // Placeholder: not tracked in gateway
  }
}
