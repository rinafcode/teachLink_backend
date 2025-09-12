import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Repository, FindManyOptions } from 'typeorm';
import { type Room, RoomStatus } from '../entities/room.entity';
import type { ParticipantService } from './participant.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RoomService {
  constructor(
    private roomRepository: Repository<Room>,
    private participantService: ParticipantService,
  ) {}

  async create(roomData: Partial<Room>, instructorId: string): Promise<Room> {
    const streamKey = uuidv4();
    const rtmpUrl = `rtmp://localhost:1935/live/${streamKey}`;

    const room = this.roomRepository.create({
      ...roomData,
      instructorId,
      streamKey,
      rtmpUrl,
    });

    return this.roomRepository.save(room);
  }

  async findById(id: string): Promise<Room> {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: [
        'instructor',
        'participants',
        'participants.user',
        'messages',
        'recordings',
      ],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  async findAll(options?: FindManyOptions<Room>): Promise<Room[]> {
    return this.roomRepository.find({
      relations: ['instructor'],
      order: { createdAt: 'DESC' },
      ...options,
    });
  }

  async findByInstructor(instructorId: string): Promise<Room[]> {
    return this.roomRepository.find({
      where: { instructorId },
      relations: ['participants'],
      order: { createdAt: 'DESC' },
    });
  }

  async findLiveRooms(): Promise<Room[]> {
    return this.roomRepository.find({
      where: { status: RoomStatus.LIVE },
      relations: ['instructor', 'participants'],
      order: { actualStartTime: 'DESC' },
    });
  }

  async startRoom(roomId: string, instructorId: string): Promise<Room> {
    const room = await this.findById(roomId);

    if (room.instructorId !== instructorId) {
      throw new ForbiddenException('Only the instructor can start this room');
    }

    if (room.status !== RoomStatus.SCHEDULED) {
      throw new BadRequestException('Room is not in scheduled status');
    }

    room.status = RoomStatus.LIVE;
    room.actualStartTime = new Date();

    return this.roomRepository.save(room);
  }

  async endRoom(roomId: string, instructorId: string): Promise<Room> {
    const room = await this.findById(roomId);

    if (room.instructorId !== instructorId) {
      throw new ForbiddenException('Only the instructor can end this room');
    }

    if (room.status !== RoomStatus.LIVE) {
      throw new BadRequestException('Room is not currently live');
    }

    room.status = RoomStatus.ENDED;
    room.actualEndTime = new Date();

    // End all active participants
    await this.participantService.endAllParticipants(roomId);

    return this.roomRepository.save(room);
  }

  async updateSettings(
    roomId: string,
    instructorId: string,
    settings: Partial<Room>,
  ): Promise<Room> {
    const room = await this.findById(roomId);

    if (room.instructorId !== instructorId) {
      throw new ForbiddenException(
        'Only the instructor can update room settings',
      );
    }

    Object.assign(room, settings);
    return this.roomRepository.save(room);
  }

  async joinRoom(
    roomId: string,
    userId: string,
  ): Promise<{ room: Room; canJoin: boolean; reason?: string }> {
    const room = await this.findById(roomId);

    if (room.status !== RoomStatus.LIVE) {
      return { room, canJoin: false, reason: 'Room is not currently live' };
    }

    const activeParticipants = room.participants.filter(
      (p) => p.status === 'joined',
    ).length;

    if (activeParticipants >= room.maxParticipants) {
      return { room, canJoin: false, reason: 'Room is at maximum capacity' };
    }

    return { room, canJoin: true };
  }

  async delete(roomId: string, instructorId: string): Promise<void> {
    const room = await this.findById(roomId);

    if (room.instructorId !== instructorId) {
      throw new ForbiddenException('Only the instructor can delete this room');
    }

    if (room.status === RoomStatus.LIVE) {
      throw new BadRequestException('Cannot delete a live room');
    }

    await this.roomRepository.remove(room);
  }

  async getStreamingInfo(
    roomId: string,
  ): Promise<{ streamKey: string; rtmpUrl: string }> {
    const room = await this.findById(roomId);
    return {
      streamKey: room.streamKey,
      rtmpUrl: room.rtmpUrl,
    };
  }
}
