import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media, MediaType, MediaStatus } from './entities/media.entity';
import { FileStorageService } from './storage/file-storage.service';
import { VideoProcessingService } from './processing/video-processing.service';
import { DocumentProcessingService } from './processing/document-processing.service';
import { UploadMediaDto, MediaResponseDto } from './dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
    private fileStorageService: FileStorageService,
    private videoProcessingService: VideoProcessingService,
    private documentProcessingService: DocumentProcessingService,
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    uploadDto: UploadMediaDto,
    user: User,
  ): Promise<MediaResponseDto> {
    // Validate file
    this.validateFile(file, uploadDto.type);

    // Upload to storage
    const uploadResult = await this.fileStorageService.uploadFile(
      file,
      `${uploadDto.type}s`,
    );

    // Create media record
    const media = this.mediaRepository.create({
      filename: uploadResult.key,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      type: uploadDto.type,
      status: MediaStatus.UPLOADING,
      storageUrl: uploadResult.url,
      uploadedById: user.id,
    });

    const savedMedia = await this.mediaRepository.save(media);

    // Process file based on type
    await this.processFile(savedMedia, file.buffer);

    return this.toResponseDto(savedMedia);
  }

  async findById(id: string, user: User): Promise<MediaResponseDto> {
    const media = await this.mediaRepository.findOne({
      where: { id },
      relations: ['uploadedBy'],
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    // Check permissions
    if (!this.canAccessMedia(media, user)) {
      throw new ForbiddenException('Access denied');
    }

    return this.toResponseDto(media);
  }

  async findAll(user: User, type?: MediaType): Promise<MediaResponseDto[]> {
    const queryBuilder = this.mediaRepository
      .createQueryBuilder('media')
      .leftJoinAndSelect('media.uploadedBy', 'uploadedBy')
      .where('media.uploadedById = :userId', { userId: user.id });

    if (type) {
      queryBuilder.andWhere('media.type = :type', { type });
    }

    const media = await queryBuilder.getMany();
    return media.map((m) => this.toResponseDto(m));
  }

  async deleteMedia(id: string, user: User): Promise<void> {
    const media = await this.mediaRepository.findOne({
      where: { id },
      relations: ['uploadedBy'],
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    if (!this.canModifyMedia(media, user)) {
      throw new ForbiddenException('Access denied');
    }

    // Delete from storage
    await this.fileStorageService.deleteFile(media.filename);

    // Delete thumbnail if exists
    if (media.thumbnailUrl) {
      const thumbnailKey = this.extractKeyFromUrl(media.thumbnailUrl);
      await this.fileStorageService.deleteFile(thumbnailKey);
    }

    // Delete processed files for videos
    if (media.type === MediaType.VIDEO && media.processingData?.qualities) {
      for (const qualityUrl of Object.values(media.processingData.qualities)) {
        const key = this.extractKeyFromUrl(qualityUrl as string);
        await this.fileStorageService.deleteFile(key);
      }
    }

    await this.mediaRepository.remove(media);
  }

  async getStreamingUrl(
    id: string,
    user: User,
    quality?: string,
  ): Promise<string> {
    const media = await this.findById(id, user);

    if (media.type !== MediaType.VIDEO) {
      throw new BadRequestException('Streaming is only available for videos');
    }

    if (media.status !== MediaStatus.READY) {
      throw new BadRequestException('Video is not ready for streaming');
    }

    // Get signed URL for the requested quality or original
    let streamingKey = media.filename;

    if (quality && media.processingData?.qualities?.[quality]) {
      streamingKey = this.extractKeyFromUrl(
        media.processingData.qualities[quality],
      );
    }

    return this.fileStorageService.getSignedUrl(streamingKey, 3600); // 1 hour expiry
  }

  async update(id: string, updateFields: Partial<Media>): Promise<Media> {
    const media = await this.mediaRepository.findOne({ where: { id } });
    if (!media) throw new NotFoundException('Media not found');
    Object.assign(media, updateFields);
    return this.mediaRepository.save(media);
  }

  async findOne(id: string): Promise<Media | null> {
    return this.mediaRepository.findOne({ where: { id } });
  }

  private async processFile(media: Media, fileBuffer: Buffer): Promise<void> {
    try {
      media.status = MediaStatus.PROCESSING;
      await this.mediaRepository.save(media);

      switch (media.type) {
        case MediaType.VIDEO:
          await this.processVideo(media);
          break;
        case MediaType.DOCUMENT:
          await this.processDocument(media, fileBuffer);
          break;
        case MediaType.IMAGE:
          await this.processImage(media);
          break;
        default:
          media.status = MediaStatus.READY;
          break;
      }

      await this.mediaRepository.save(media);
    } catch (error) {
      media.status = MediaStatus.FAILED;
      await this.mediaRepository.save(media);
      throw error;
    }
  }

  private async processVideo(media: Media): Promise<void> {
    // Start video transcoding
    const transcodeJob = await this.videoProcessingService.transcodeVideo(
      media.filename,
      media.filename.replace(/\.[^/.]+$/, ''), // Remove extension
    );

    // Generate thumbnail
    const thumbnailKey = `thumbnails/${media.filename.replace(/\.[^/.]+$/, '.jpg')}`;
    await this.videoProcessingService.generateThumbnail(
      media.filename,
      thumbnailKey,
    );

    media.processingData = {
      transcodeJobId: transcodeJob.jobId,
      qualities: transcodeJob.outputs,
    };
    media.thumbnailUrl =
      await this.fileStorageService.getSignedUrl(thumbnailKey);
    media.status = MediaStatus.READY; // Will be updated when transcoding completes
  }

  private async processDocument(
    media: Media,
    fileBuffer: Buffer,
  ): Promise<void> {
    if (media.mimeType === 'application/pdf') {
      const metadata =
        await this.documentProcessingService.processPDF(fileBuffer);
      media.metadata = {
        pageCount: metadata.pageCount,
        wordCount: metadata.wordCount,
      };
    }

    media.status = MediaStatus.READY;
  }

  private async processImage(media: Media): Promise<void> {
    // For images, we could generate thumbnails, extract EXIF data, etc.
    media.status = MediaStatus.READY;
  }

  private validateFile(file: Express.Multer.File, type: MediaType): void {
    const maxSizes = {
      [MediaType.IMAGE]: 10 * 1024 * 1024, // 10MB
      [MediaType.VIDEO]: 500 * 1024 * 1024, // 500MB
      [MediaType.DOCUMENT]: 50 * 1024 * 1024, // 50MB
      [MediaType.AUDIO]: 100 * 1024 * 1024, // 100MB
    };

    const allowedMimeTypes = {
      [MediaType.IMAGE]: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      [MediaType.VIDEO]: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'],
      [MediaType.DOCUMENT]: [
        'application/pdf',
        'text/plain',
        'application/msword',
      ],
      [MediaType.AUDIO]: ['audio/mp3', 'audio/wav', 'audio/ogg'],
    };

    if (file.size > maxSizes[type]) {
      throw new BadRequestException(`File size exceeds limit for ${type}`);
    }

    if (!allowedMimeTypes[type].includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type for ${type}`);
    }
  }

  private canAccessMedia(media: Media, user: User): boolean {
    // Basic permission check - user can access their own files
    // You can extend this with more complex permission logic
    return media.uploadedById === user.id;
  }

  private canModifyMedia(media: Media, user: User): boolean {
    // Basic permission check - user can modify their own files
    return media.uploadedById === user.id;
  }

  private extractKeyFromUrl(url: string): string {
    // Extract S3 key from URL
    const urlParts = url.split('/');
    return urlParts.slice(-2).join('/'); // Get last two parts (folder/filename)
  }

  private toResponseDto(media: Media): MediaResponseDto {
    return {
      id: media.id,
      filename: media.filename,
      originalName: media.originalName,
      mimeType: media.mimeType,
      size: media.size,
      type: media.type,
      status: media.status,
      storageUrl: media.storageUrl,
      thumbnailUrl: media.thumbnailUrl,
      metadata: media.metadata,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt,
    };
  }
}
