import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import { type Recording, RecordingStatus } from '../entities/recording.entity';
import type { Room } from '../entities/room.entity';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class RecordingService {
  private recordingRepository: Repository<Recording>;
  private roomRepository: Repository<Room>;

  constructor(
    recordingRepository: Repository<Recording>,
    roomRepository: Repository<Room>,
  ) {
    this.recordingRepository = recordingRepository;
    this.roomRepository = roomRepository;
  }

  async startRecording(
    roomId: string,
    instructorId: string,
  ): Promise<Recording> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.instructorId !== instructorId) {
      throw new ForbiddenException('Only the instructor can start recording');
    }

    // Check if there's already an active recording
    const activeRecording = await this.recordingRepository.findOne({
      where: { roomId, status: RecordingStatus.RECORDING },
    });

    if (activeRecording) {
      throw new ForbiddenException('Recording is already in progress');
    }

    const filename = `recording_${roomId}_${Date.now()}.mp4`;
    const filePath = path.join('uploads', 'recordings', filename);

    const recording = this.recordingRepository.create({
      roomId,
      filename,
      filePath,
      status: RecordingStatus.RECORDING,
      startedAt: new Date(),
    });

    // Update room recording status
    room.isRecording = true;
    await this.roomRepository.save(room);

    return this.recordingRepository.save(recording);
  }

  async stopRecording(
    roomId: string,
    instructorId: string,
  ): Promise<Recording> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.instructorId !== instructorId) {
      throw new ForbiddenException('Only the instructor can stop recording');
    }

    const recording = await this.recordingRepository.findOne({
      where: { roomId, status: RecordingStatus.RECORDING },
    });

    if (!recording) {
      throw new NotFoundException('No active recording found');
    }

    recording.status = RecordingStatus.PROCESSING;
    recording.endedAt = new Date();

    // Calculate duration in seconds
    const duration = Math.floor(
      (recording.endedAt.getTime() - recording.startedAt.getTime()) / 1000,
    );
    recording.duration = duration;

    // Update room recording status
    room.isRecording = false;
    await this.roomRepository.save(room);

    const savedRecording = await this.recordingRepository.save(recording);

    // Start processing in background (simulate)
    this.processRecording(savedRecording.id);

    return savedRecording;
  }

  private async processRecording(recordingId: string): Promise<void> {
    // Simulate recording processing
    setTimeout(async () => {
      try {
        const recording = await this.recordingRepository.findOne({
          where: { id: recordingId },
        });
        if (recording) {
          // Simulate file processing and get file size
          const fileSize = Math.floor(Math.random() * 1000000000); // Random file size for demo

          recording.status = RecordingStatus.COMPLETED;
          recording.fileSize = fileSize;
          recording.downloadUrl = `/api/recordings/${recordingId}/download`;

          await this.recordingRepository.save(recording);
        }
      } catch (error) {
        // Handle processing error
        await this.recordingRepository.update(recordingId, {
          status: RecordingStatus.FAILED,
        });
      }
    }, 5000); // 5 seconds processing time for demo
  }

  async getRoomRecordings(roomId: string): Promise<Recording[]> {
    return this.recordingRepository.find({
      where: { roomId },
      order: { createdAt: 'DESC' },
    });
  }

  async getRecording(recordingId: string): Promise<Recording> {
    const recording = await this.recordingRepository.findOne({
      where: { id: recordingId },
      relations: ['room'],
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    return recording;
  }

  async deleteRecording(
    recordingId: string,
    instructorId: string,
  ): Promise<void> {
    const recording = await this.recordingRepository.findOne({
      where: { id: recordingId },
      relations: ['room'],
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    if (recording.room.instructorId !== instructorId) {
      throw new ForbiddenException('Only the instructor can delete recordings');
    }

    // Delete file from filesystem
    if (recording.filePath) {
      try {
        await fs.unlink(recording.filePath);
      } catch (error) {
        console.error('Error deleting recording file:', error);
      }
    }

    await this.recordingRepository.remove(recording);
  }

  async getRecordingStats(): Promise<{
    totalRecordings: number;
    totalDuration: number;
    totalSize: number;
    statusBreakdown: Record<RecordingStatus, number>;
  }> {
    const recordings = await this.recordingRepository.find();

    const statusBreakdown: Record<RecordingStatus, number> = {
      [RecordingStatus.STARTING]: 0,
      [RecordingStatus.RECORDING]: 0,
      [RecordingStatus.STOPPING]: 0,
      [RecordingStatus.COMPLETED]: 0,
      [RecordingStatus.FAILED]: 0,
      [RecordingStatus.PROCESSING]: 0,
      [RecordingStatus.READY]: 0,
    };

    let totalDuration = 0;
    let totalSize = 0;

    recordings.forEach((recording) => {
      statusBreakdown[recording.status]++;
      totalDuration += recording.duration;
      totalSize += Number(recording.fileSize);
    });

    return {
      totalRecordings: recordings.length,
      totalDuration,
      totalSize,
      statusBreakdown,
    };
  }
}
