import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import { type Message, MessageType } from '../entities/message.entity';
import type { Room } from '../entities/room.entity';
import type { ParticipantService } from './participant.service';

@Injectable()
export class MessageService {
  constructor(
    private messageRepository: Repository<Message>,
    private roomRepository: Repository<Room>,
    private participantService: ParticipantService,
  ) {}

  async sendMessage(
    roomId: string,
    userId: string,
    content: string,
    type: MessageType = MessageType.TEXT,
    metadata?: Record<string, any>,
  ): Promise<Message> {
    // Verify room exists and chat is allowed
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (!room.allowChat) {
      throw new ForbiddenException('Chat is disabled in this room');
    }

    // Verify user is a participant in the room
    const participants =
      await this.participantService.getRoomParticipants(roomId);
    const isParticipant = participants.some((p) => p.userId === userId);

    if (!isParticipant && room.instructorId !== userId) {
      throw new ForbiddenException('User is not a participant in this room');
    }

    const message = this.messageRepository.create({
      roomId,
      senderId: userId,
      content,
      type,
      metadata,
    });

    return this.messageRepository.save(message);
  }

  async getRoomMessages(
    roomId: string,
    limit = 50,
    offset = 0,
  ): Promise<Message[]> {
    return this.messageRepository.find({
      where: { roomId },
      relations: ['room'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['room'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only message sender or room instructor can delete
    if (message.senderId !== userId && message.room.instructorId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.messageRepository.remove(message);
  }

  async sendSystemMessage(
    roomId: string,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<Message> {
    // System messages don't need user validation
    const message = this.messageRepository.create({
      roomId,
      senderId: 'system',
      content,
      type: MessageType.SYSTEM,
      metadata,
    });

    return this.messageRepository.save(message);
  }

  async getMessageStats(roomId: string): Promise<{
    totalMessages: number;
    messagesByType: Record<MessageType, number>;
    activeUsers: number;
  }> {
    const messages = await this.messageRepository.find({
      where: { roomId },
      relations: ['room'],
    });

    const messagesByType: Record<MessageType, number> = {
      [MessageType.TEXT]: 0,
      [MessageType.IMAGE]: 0,
      [MessageType.SYSTEM]: 0,
      [MessageType.FILE]: 0,
    };

    const uniqueUsers = new Set<string>();

    messages.forEach((message) => {
      messagesByType[message.type]++;
      if (message.senderId) {
        uniqueUsers.add(message.senderId);
      }
    });

    return {
      totalMessages: messages.length,
      messagesByType,
      activeUsers: uniqueUsers.size,
    };
  }

  async clearRoomMessages(roomId: string, instructorId: string): Promise<void> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.instructorId !== instructorId) {
      throw new ForbiddenException(
        'Only the instructor can clear room messages',
      );
    }

    const roomMessages = await this.messageRepository.find({ where: { roomId } });
    if (roomMessages.length > 0) {
      await this.messageRepository.remove(roomMessages);
    }
  }
}
