import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  ParseUUIDPipe,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Repository } from 'typeorm';
import type { Express } from 'express';

import { type Video, VideoStatus } from '../entities/video.entity';
import type { VideoProcessingService } from '../services/video-processing.service';
import type { QueueService } from '../services/queue.service';
import type { StorageService } from '../services/storage.service';

import type { UploadVideoDto, ProcessVideoDto } from '../dto/upload-video.dto';
import type { VideoQueryDto } from '../dto/query.dto';
import {
  VideoResponseDto,
  UploadResponseDto,
  ProcessingStatusResponseDto,
  ProcessingResultResponseDto,
} from '../dto/video-response.dto';

@ApiTags('Videos')
@Controller('videos')
export class VideoController {
  private readonly logger = new Logger(VideoController.name);

  constructor(
    private readonly videoRepository: Repository<Video>,
    private readonly videoProcessingService: VideoProcessingService,
    private readonly queueService: QueueService,
    private readonly storageService: StorageService,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a video file' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Video uploaded successfully',
    type: UploadResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid file or request data' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('video/')) {
          return callback(
            new BadRequestException('Only video files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024 * 1024, // 5GB limit
      },
    }),
  )
  async uploadVideo(
    file: Express.Multer.File,
    @Body() uploadVideoDto: UploadVideoDto,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No video file provided');
    }

    this.logger.log(`Uploading video: ${file.originalname}`);

    // Create video record
    const video = this.videoRepository.create({
      title: uploadVideoDto.title,
      description: uploadVideoDto.description,
      originalFilePath: file.path,
      originalFileName: file.originalname,
      originalFileSize: file.size,
      originalMimeType: file.mimetype,
      type: uploadVideoDto.type,
      courseId: uploadVideoDto.courseId,
      uploadedBy: uploadVideoDto.uploadedBy,
      status: VideoStatus.UPLOADED,
    });

    const savedVideo = await this.videoRepository.save(video);

    return {
      videoId: savedVideo.id,
      message: 'Video uploaded successfully',
      filePath: file.path,
      fileSize: file.size,
    };
  }

  @Post(':id/process')
  @ApiOperation({ summary: 'Start video processing' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({
    status: 200,
    description: 'Processing started',
    type: ProcessingResultResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiResponse({ status: 400, description: 'Video cannot be processed' })
  async processVideo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() processVideoDto: ProcessVideoDto,
  ): Promise<ProcessingResultResponseDto> {
    this.logger.log(`Starting processing for video: ${id}`);

    const video = await this.videoRepository.findOne({ where: { id } });
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const result = await this.videoProcessingService.processVideo(id, {
      qualities: processVideoDto.qualities,
      formats: processVideoDto.formats,
      generateThumbnails: processVideoDto.generateThumbnails,
      generatePreviews: processVideoDto.generatePreviews,
      enableAdaptiveStreaming: processVideoDto.enableAdaptiveStreaming,
      priority: processVideoDto.priority,
    });

    return result;
  }

  @Get()
  @ApiOperation({ summary: 'Get videos with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Videos retrieved successfully',
    type: [VideoResponseDto],
  })
  async getVideos(@Query() query: VideoQueryDto) {
    const {
      page,
      limit,
      status,
      type,
      courseId,
      uploadedBy,
      search,
      createdAfter,
      createdBefore,
      sortBy,
      sortOrder,
    } = query;

    const queryBuilder = this.videoRepository
      .createQueryBuilder('video')
      .leftJoinAndSelect('video.variants', 'variants')
      .leftJoinAndSelect('video.processingJobs', 'jobs');

    // Apply filters
    if (status) {
      queryBuilder.andWhere('video.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('video.type = :type', { type });
    }

    if (courseId) {
      queryBuilder.andWhere('video.courseId = :courseId', { courseId });
    }

    if (uploadedBy) {
      queryBuilder.andWhere('video.uploadedBy = :uploadedBy', { uploadedBy });
    }

    if (search) {
      queryBuilder.andWhere(
        '(video.title ILIKE :search OR video.description ILIKE :search)',
        {
          search: `%${search}%`,
        },
      );
    }

    if (createdAfter) {
      queryBuilder.andWhere('video.createdAt >= :createdAfter', {
        createdAfter,
      });
    }

    if (createdBefore) {
      queryBuilder.andWhere('video.createdAt <= :createdBefore', {
        createdBefore,
      });
    }

    // Apply sorting
    queryBuilder.orderBy(`video.${sortBy}`, sortOrder);

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [videos, total] = await queryBuilder.getManyAndCount();

    return {
      data: videos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get video by ID' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({
    status: 200,
    description: 'Video retrieved successfully',
    type: VideoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async getVideo(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VideoResponseDto> {
    const video = await this.videoRepository.findOne({
      where: { id },
      relations: ['variants', 'processingJobs'],
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    return video as VideoResponseDto;
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get video processing status' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({
    status: 200,
    description: 'Status retrieved successfully',
    type: ProcessingStatusResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async getProcessingStatus(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProcessingStatusResponseDto> {
    const status = await this.videoProcessingService.getProcessingStatus(id);
    return status;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update video metadata' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({
    status: 200,
    description: 'Video updated successfully',
    type: VideoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async updateVideo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: Partial<UploadVideoDto>,
  ): Promise<VideoResponseDto> {
    const video = await this.videoRepository.findOne({ where: { id } });
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Update allowed fields
    if (updateData.title) video.title = updateData.title;
    if (updateData.description !== undefined)
      video.description = updateData.description;
    if (updateData.type) video.type = updateData.type;
    if (updateData.courseId !== undefined) video.courseId = updateData.courseId;

    const updatedVideo = await this.videoRepository.save(video);
    return updatedVideo as VideoResponseDto;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete video and all associated data' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({ status: 200, description: 'Video deleted successfully' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async deleteVideo(@Param('id', ParseUUIDPipe) id: string) {
    const video = await this.videoRepository.findOne({
      where: { id },
      relations: ['variants', 'processingJobs'],
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Cancel any ongoing processing
    if (video.status === VideoStatus.PROCESSING) {
      await this.videoProcessingService.cancelProcessing(id);
    }

    // Delete physical files
    try {
      await this.storageService.deleteFile(video.originalFilePath);

      // Delete variant files
      for (const variant of video.variants || []) {
        try {
          await this.storageService.deleteFile(variant.filePath);
        } catch (error) {
          this.logger.warn(
            `Failed to delete variant file: ${variant.filePath}`,
          );
        }
      }

      // Delete thumbnails and previews
      if (video.thumbnailPath) {
        await this.storageService.deleteFile(video.thumbnailPath);
      }
      if (video.previewPath) {
        await this.storageService.deleteFile(video.previewPath);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete some files for video ${id}`);
    }

    // Delete database record (cascades to variants and jobs)
    await this.videoRepository.remove(video);

    return { message: 'Video deleted successfully' };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel video processing' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({
    status: 200,
    description: 'Processing cancelled successfully',
  })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiResponse({ status: 400, description: 'Video is not being processed' })
  async cancelProcessing(@Param('id', ParseUUIDPipe) id: string) {
    const video = await this.videoRepository.findOne({ where: { id } });
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    if (video.status !== VideoStatus.PROCESSING) {
      throw new BadRequestException('Video is not being processed');
    }

    await this.videoProcessingService.cancelProcessing(id);
    return { message: 'Processing cancelled successfully' };
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry failed video processing' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({
    status: 200,
    description: 'Processing retry started',
    type: ProcessingResultResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiResponse({ status: 400, description: 'Video is not in failed state' })
  async retryProcessing(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() processVideoDto: ProcessVideoDto,
  ): Promise<ProcessingResultResponseDto> {
    const video = await this.videoRepository.findOne({ where: { id } });
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    if (video.status !== VideoStatus.FAILED) {
      throw new BadRequestException('Video is not in failed state');
    }

    // Reset video status
    video.status = VideoStatus.UPLOADED;
    video.processingError = null;
    video.processingProgress = 0;
    await this.videoRepository.save(video);

    // Start processing again
    const result = await this.videoProcessingService.processVideo(id, {
      qualities: processVideoDto.qualities,
      formats: processVideoDto.formats,
      generateThumbnails: processVideoDto.generateThumbnails,
      generatePreviews: processVideoDto.generatePreviews,
      enableAdaptiveStreaming: processVideoDto.enableAdaptiveStreaming,
      priority: processVideoDto.priority,
    });

    return result;
  }
}
