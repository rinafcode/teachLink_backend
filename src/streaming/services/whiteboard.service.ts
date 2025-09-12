import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type {
  WhiteboardAnnotation,
  AnnotationType,
} from '../entities/whiteboard-annotation.entity';
import type { ParticipantService } from './participant.service';
import { ParticipantRole } from '../entities/participant.entity';

@Injectable()
export class WhiteboardService {
  constructor(
    private annotationRepository: Repository<WhiteboardAnnotation>,
    private participantService: ParticipantService,
  ) {}

  async addAnnotation(
    roomId: string,
    userId: string,
    type: AnnotationType,
    data: Record<string, any>,
  ): Promise<WhiteboardAnnotation> {
    // Verify user has permission to draw on whiteboard
    const participants =
      await this.participantService.getRoomParticipants(roomId);
    const participant = participants.find((p) => p.userId === userId);

    if (!participant) {
      throw new ForbiddenException('User is not a participant in this room');
    }

    // Only presenters and moderators can draw by default
    if (participant.role === ParticipantRole.VIEWER) {
      throw new ForbiddenException(
        'Only presenters and moderators can use the whiteboard',
      );
    }

    const annotation = this.annotationRepository.create({
      roomId,
      createdBy: userId,
      type,
      data,
    });

    return this.annotationRepository.save(annotation);
  }

  async getRoomAnnotations(roomId: string): Promise<WhiteboardAnnotation[]> {
    return this.annotationRepository.find({
      where: { roomId },
      relations: ['room'],
      order: { createdAt: 'ASC' },
    });
  }

  async deleteAnnotation(annotationId: string, userId: string): Promise<void> {
    const annotation = await this.annotationRepository.findOne({
      where: { id: annotationId },
      relations: ['room'],
    });

    if (!annotation) {
      throw new NotFoundException('Annotation not found');
    }

    // Check if user can delete this annotation
    const participants = await this.participantService.getRoomParticipants(
      annotation.roomId,
    );
    const participant = participants.find((p) => p.userId === userId);

    const canDelete =
      annotation.createdBy === userId || // Own annotation
      participant?.role === ParticipantRole.MODERATOR || // Moderator
      participant?.role === ParticipantRole.PRESENTER; // Presenter

    if (!canDelete) {
      throw new ForbiddenException(
        "You don't have permission to delete this annotation",
      );
    }

    await this.annotationRepository.remove(annotation);
  }

  async clearWhiteboard(roomId: string, userId: string): Promise<void> {
    // Verify user has permission to clear whiteboard
    const participants =
      await this.participantService.getRoomParticipants(roomId);
    const participant = participants.find((p) => p.userId === userId);

    if (!participant || participant.role === ParticipantRole.VIEWER) {
      throw new ForbiddenException(
        'Only presenters and moderators can clear the whiteboard',
      );
    }

    const annotations = await this.annotationRepository.find({ where: { roomId } });
    if (annotations.length > 0) {
      await this.annotationRepository.remove(annotations);
    }
  }

  async updateAnnotation(
    annotationId: string,
    userId: string,
    data: Record<string, any>,
  ): Promise<WhiteboardAnnotation> {
    const annotation = await this.annotationRepository.findOne({
      where: { id: annotationId },
    });

    if (!annotation) {
      throw new NotFoundException('Annotation not found');
    }

    if (annotation.createdBy !== userId) {
      throw new ForbiddenException('You can only update your own annotations');
    }

    annotation.data = { ...annotation.data, ...data };
    return this.annotationRepository.save(annotation);
  }

  async getAnnotationsByType(
    roomId: string,
    type: AnnotationType,
  ): Promise<WhiteboardAnnotation[]> {
    return this.annotationRepository.find({
      where: { roomId, type },
      relations: ['room'],
      order: { createdAt: 'ASC' },
    });
  }

  async exportWhiteboard(roomId: string): Promise<WhiteboardAnnotation[]> {
    return this.annotationRepository.find({
      where: { roomId },
      relations: ['room'],
      order: { createdAt: 'ASC' },
    });
  }
}
