import { Injectable } from "@nestjs/common"
import type { StreamingGateway } from "../gateways/streaming.gateway"

@Injectable()
export class WebSocketNotificationService {
  constructor(private readonly streamingGateway: StreamingGateway) {}

  async notifyRoomStatusChange(roomId: string, status: string) {
    await this.streamingGateway.broadcastToRoom("room-status-changed", roomId, {
      roomId,
      status,
      timestamp: new Date(),
    })
  }

  async notifyRecordingStarted(roomId: string, startedBy: any) {
    await this.streamingGateway.broadcastToRoom("recording-started", roomId, {
      roomId,
      startedBy,
      startedAt: new Date(),
    })
  }

  async notifyRecordingCompleted(roomId: string, recordingId: string, duration: number) {
    await this.streamingGateway.broadcastToRoom("recording-completed", roomId, {
      roomId,
      recordingId,
      duration,
      completedAt: new Date(),
    })
  }

  async notifyStreamHealthUpdate(roomId: string, healthData: any) {
    await this.streamingGateway.broadcastToRoom("stream-health-update", roomId, {
      roomId,
      ...healthData,
      timestamp: new Date(),
    })
  }

  async notifyParticipantRoleChanged(roomId: string, userId: string, newRole: string, changedBy: string) {
    await this.streamingGateway.broadcastToRoom("participant-role-changed", roomId, {
      userId,
      newRole,
      changedBy,
      timestamp: new Date(),
    })
  }

  async notifySystemMessage(roomId: string, message: string, metadata?: any) {
    await this.streamingGateway.broadcastToRoom("system-message", roomId, {
      message,
      metadata,
      timestamp: new Date(),
    })
  }

  async notifyUserDirectly(userId: string, event: string, data: any) {
    await this.streamingGateway.broadcastToUser(userId, event, data)
  }

  async getRoomParticipantCount(roomId: string): Promise<number> {
    return this.streamingGateway.getRoomParticipantCount(roomId)
  }

  async isUserInRoom(userId: string, roomId: string): Promise<boolean> {
    return this.streamingGateway.isUserInRoom(userId, roomId)
  }
}
