import { Injectable, NotFoundException, ConflictException, ForbiddenException } from "@nestjs/common"
import type { Repository } from "typeorm"
import { type Participant, ParticipantStatus, ParticipantRole } from "../entities/participant.entity"

@Injectable()
export class ParticipantService {
  constructor(private participantRepository: Repository<Participant>) {}

  async joinRoom(roomId: string, userId: string, role: ParticipantRole = ParticipantRole.VIEWER): Promise<Participant> {
    // Check if user is already in the room
    const existingParticipant = await this.participantRepository.findOne({
      where: { roomId, userId },
    })

    if (existingParticipant && existingParticipant.status === ParticipantStatus.JOINED) {
      throw new ConflictException("User is already in the room")
    }

    if (existingParticipant) {
      // Rejoin the room
      existingParticipant.status = ParticipantStatus.JOINED
      existingParticipant.joinedAt = new Date()
      existingParticipant.leftAt = null
      return this.participantRepository.save(existingParticipant)
    }

    const participant = this.participantRepository.create({
      roomId,
      userId,
      role,
      status: ParticipantStatus.JOINED,
      joinedAt: new Date(),
    })

    return this.participantRepository.save(participant)
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const participant = await this.participantRepository.findOne({
      where: { roomId, userId, status: ParticipantStatus.JOINED },
    })

    if (!participant) {
      throw new NotFoundException("Participant not found in room")
    }

    participant.status = ParticipantStatus.LEFT
    participant.leftAt = new Date()
    participant.isVideoEnabled = false
    participant.isAudioEnabled = false
    participant.isScreenSharing = false
    participant.isHandRaised = false

    await this.participantRepository.save(participant)
  }

  async updateParticipantMedia(
    roomId: string,
    userId: string,
    mediaSettings: {
      isVideoEnabled?: boolean
      isAudioEnabled?: boolean
      isScreenSharing?: boolean
    },
  ): Promise<Participant> {
    const participant = await this.participantRepository.findOne({
      where: { roomId, userId, status: ParticipantStatus.JOINED },
    })

    if (!participant) {
      throw new NotFoundException("Participant not found in room")
    }

    Object.assign(participant, mediaSettings)
    return this.participantRepository.save(participant)
  }

  async raiseHand(roomId: string, userId: string): Promise<Participant> {
    const participant = await this.participantRepository.findOne({
      where: { roomId, userId, status: ParticipantStatus.JOINED },
    })

    if (!participant) {
      throw new NotFoundException("Participant not found in room")
    }

    participant.isHandRaised = !participant.isHandRaised
    return this.participantRepository.save(participant)
  }

  async updateRole(
    roomId: string,
    userId: string,
    newRole: ParticipantRole,
    moderatorId: string,
  ): Promise<Participant> {
    const moderator = await this.participantRepository.findOne({
      where: { roomId, userId: moderatorId },
    })

    if (!moderator || (moderator.role !== ParticipantRole.MODERATOR && moderator.role !== ParticipantRole.PRESENTER)) {
      throw new ForbiddenException("Only moderators can change participant roles")
    }

    const participant = await this.participantRepository.findOne({
      where: { roomId, userId, status: ParticipantStatus.JOINED },
    })

    if (!participant) {
      throw new NotFoundException("Participant not found in room")
    }

    participant.role = newRole
    return this.participantRepository.save(participant)
  }

  async kickParticipant(roomId: string, userId: string, moderatorId: string): Promise<void> {
    const moderator = await this.participantRepository.findOne({
      where: { roomId, userId: moderatorId },
    })

    if (!moderator || (moderator.role !== ParticipantRole.MODERATOR && moderator.role !== ParticipantRole.PRESENTER)) {
      throw new ForbiddenException("Only moderators can kick participants")
    }

    const participant = await this.participantRepository.findOne({
      where: { roomId, userId, status: ParticipantStatus.JOINED },
    })

    if (!participant) {
      throw new NotFoundException("Participant not found in room")
    }

    participant.status = ParticipantStatus.KICKED
    participant.leftAt = new Date()
    await this.participantRepository.save(participant)
  }

  async getRoomParticipants(roomId: string): Promise<Participant[]> {
    return this.participantRepository.find({
      where: { roomId, status: ParticipantStatus.JOINED },
      relations: ["user"],
      order: { joinedAt: "ASC" },
    })
  }

  async endAllParticipants(roomId: string): Promise<void> {
    await this.participantRepository.update(
      { roomId, status: ParticipantStatus.JOINED },
      {
        status: ParticipantStatus.LEFT,
        leftAt: new Date(),
        isVideoEnabled: false,
        isAudioEnabled: false,
        isScreenSharing: false,
        isHandRaised: false,
      },
    )
  }

  async getParticipantStats(roomId: string): Promise<{
    total: number
    active: number
    withVideo: number
    withAudio: number
    handsRaised: number
  }> {
    const participants = await this.getRoomParticipants(roomId)

    return {
      total: participants.length,
      active: participants.filter((p) => p.status === ParticipantStatus.JOINED).length,
      withVideo: participants.filter((p) => p.isVideoEnabled).length,
      withAudio: participants.filter((p) => p.isAudioEnabled).length,
      handsRaised: participants.filter((p) => p.isHandRaised).length,
    }
  }
}
