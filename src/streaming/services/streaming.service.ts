import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common"
import type { RoomService } from "./room.service"
import type { ParticipantService } from "./participant.service"
import type { RecordingService } from "./recording.service"
import { type Room, RoomStatus } from "../entities/room.entity"

export interface StreamingStats {
  viewerCount: number
  duration: number
  peakViewers: number
  chatMessages: number
  isRecording: boolean
}

export interface WebRTCOffer {
  type: "offer"
  sdp: string
}

export interface WebRTCAnswer {
  type: "answer"
  sdp: string
}

export interface ICECandidate {
  candidate: string
  sdpMLineIndex: number
  sdpMid: string
}

@Injectable()
export class StreamingService {
  private streamingStats = new Map<string, StreamingStats>()
  private peerConnections = new Map<string, any>() // Store WebRTC connections

  constructor(
    private roomService: RoomService,
    private participantService: ParticipantService,
    private recordingService: RecordingService,
  ) {}

  async initializeStream(roomId: string, instructorId: string): Promise<Room> {
    const room = await this.roomService.startRoom(roomId, instructorId)

    // Initialize streaming stats
    this.streamingStats.set(roomId, {
      viewerCount: 0,
      duration: 0,
      peakViewers: 0,
      chatMessages: 0,
      isRecording: false,
    })

    return room
  }

  async handleWebRTCOffer(roomId: string, userId: string, offer: WebRTCOffer): Promise<WebRTCAnswer> {
    // Verify user is in the room
    const participants = await this.participantService.getRoomParticipants(roomId)
    const participant = participants.find((p) => p.userId === userId)

    if (!participant) {
      throw new BadRequestException("User is not a participant in this room")
    }

    // In a real implementation, you would:
    // 1. Create a WebRTC peer connection
    // 2. Set the remote description with the offer
    // 3. Create and return an answer
    // For this demo, we'll return a mock answer

    const connectionId = `${roomId}_${userId}`
    this.peerConnections.set(connectionId, {
      roomId,
      userId,
      offer,
      createdAt: new Date(),
    })

    // Mock WebRTC answer
    const answer: WebRTCAnswer = {
      type: "answer",
      sdp: `v=0\r\no=- ${Date.now()} 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n...`, // Simplified SDP
    }

    return answer
  }

  async handleICECandidate(roomId: string, userId: string, candidate: ICECandidate): Promise<void> {
    const connectionId = `${roomId}_${userId}`
    const connection = this.peerConnections.get(connectionId)

    if (!connection) {
      throw new NotFoundException("WebRTC connection not found")
    }

    // In a real implementation, you would add the ICE candidate to the peer connection
    console.log(`Adding ICE candidate for ${connectionId}:`, candidate)
  }

  async updateStreamingStats(roomId: string, stats: Partial<StreamingStats>): Promise<void> {
    const currentStats = this.streamingStats.get(roomId)
    if (currentStats) {
      const updatedStats = { ...currentStats, ...stats }
      if (updatedStats.viewerCount > updatedStats.peakViewers) {
        updatedStats.peakViewers = updatedStats.viewerCount
      }
      this.streamingStats.set(roomId, updatedStats)
    }
  }

  async getStreamingStats(roomId: string): Promise<StreamingStats> {
    const stats = this.streamingStats.get(roomId)
    if (!stats) {
      throw new NotFoundException("Streaming stats not found for room")
    }

    // Update real-time data
    const participants = await this.participantService.getRoomParticipants(roomId)
    stats.viewerCount = participants.length

    const room = await this.roomService.findById(roomId)
    stats.isRecording = room.isRecording

    if (room.actualStartTime) {
      stats.duration = Math.floor((Date.now() - room.actualStartTime.getTime()) / 1000)
    }

    return stats
  }

  async endStream(roomId: string, instructorId: string): Promise<void> {
    await this.roomService.endRoom(roomId, instructorId)

    // Clean up streaming resources
    this.streamingStats.delete(roomId)

    // Close all WebRTC connections for this room
    const connectionsToClose = Array.from(this.peerConnections.entries()).filter(([connectionId]) =>
      connectionId.startsWith(roomId),
    )

    connectionsToClose.forEach(([connectionId]) => {
      this.peerConnections.delete(connectionId)
    })

    // Stop recording if active
    const room = await this.roomService.findById(roomId)
    if (room.isRecording) {
      await this.recordingService.stopRecording(roomId, instructorId)
    }
  }

  async getActiveStreams(): Promise<Room[]> {
    return this.roomService.findLiveRooms()
  }

  async validateStreamAccess(roomId: string, userId: string): Promise<boolean> {
    try {
      const { canJoin } = await this.roomService.joinRoom(roomId, userId)
      return canJoin
    } catch (error) {
      return false
    }
  }

  async getStreamingHealth(roomId: string): Promise<{
    status: "healthy" | "warning" | "error"
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      const room = await this.roomService.findById(roomId)
      const stats = await this.getStreamingStats(roomId)

      // Check room status
      if (room.status !== RoomStatus.LIVE) {
        issues.push("Room is not currently live")
      }

      // Check viewer count
      if (stats.viewerCount === 0) {
        issues.push("No active viewers")
        recommendations.push("Check stream promotion and accessibility")
      }

      // Check connection health
      const activeConnections = Array.from(this.peerConnections.entries()).filter(([connectionId]) =>
        connectionId.startsWith(roomId),
      ).length

      if (activeConnections < stats.viewerCount) {
        issues.push("Some viewers may have connection issues")
        recommendations.push("Monitor WebRTC connection stability")
      }

      const status = issues.length === 0 ? "healthy" : issues.length <= 2 ? "warning" : "error"

      return { status, issues, recommendations }
    } catch (error) {
      return {
        status: "error",
        issues: ["Unable to retrieve streaming health data"],
        recommendations: ["Check room configuration and network connectivity"],
      }
    }
  }
}
