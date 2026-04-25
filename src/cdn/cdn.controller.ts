import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UploadedFile as FileUpload } from '../common/types/file.types';
import { CdnService } from './cdn.service';
import { UploadContentDto } from './dto/upload-content.dto';
import { ContentMetadata } from './entities/content-metadata.entity';
import {
  FileValidationService,
  FileValidationResult,
} from '../media/validation/file-validation.service';
import { MalwareScanningService } from '../media/validation/malware-scanning.service';
import { ImageProcessingService } from '../media/processing/image-processing.service';
import {
  ALLOWED_FILE_TYPES,
  FILE_SIZE_LIMITS,
} from '../media/validation/file-validation.constants';

@ApiTags('CDN')
@Controller('cdn')
export class CdnController {
  private readonly logger = new Logger(CdnController.name);

  constructor(
    private readonly cdnService: CdnService,
    private readonly fileValidation: FileValidationService,
    private readonly malwareScanning: MalwareScanningService,
    private readonly imageProcessing: ImageProcessingService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload content to CDN with full validation' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Content upload with validation and optimization options',
    type: UploadContentDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Content uploaded successfully',
    type: ContentMetadata,
  })
  @ApiResponse({ status: 400, description: 'Validation failed or bad request' })
  @ApiResponse({ status: 403, description: 'Malware detected' })
  @ApiResponse({ status: 413, description: 'File too large' })
  @ApiResponse({ status: 415, description: 'Unsupported media type' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async uploadContent(
    @UploadedFile() file: FileUpload,
    @Body() options: UploadContentDto,
  ): Promise<ContentMetadata> {
    try {
      if (!file) {
        throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Uploading file: ${file.originalname} (${file.size} bytes)`);

      // Step 1: Validate file
      const validationResult = await this.fileValidation.validateFile(file);
      if (!validationResult.valid) {
        this.logger.warn(
          `File validation failed for ${file.originalname}:`,
          validationResult.errors,
        );
        throw new BadRequestException({
          message: 'File validation failed',
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          allowedTypes: Object.values(ALLOWED_FILE_TYPES).flat(),
          sizeLimits: FILE_SIZE_LIMITS,
        });
      }

      // Step 2: Malware scan
      if (this.malwareScanning.isScanningAvailable()) {
        this.logger.log(`Scanning file for malware: ${file.originalname}`);
        const scanResult = await this.malwareScanning.scanFile(file);

        if (!scanResult.clean) {
          const errorMsg =
            scanResult.threats.length > 0
              ? `Malware detected: ${scanResult.threats.join(', ')}`
              : 'File failed security scan';
          this.logger.error(`Malware detected in ${file.originalname}:`, scanResult.threats);
          throw new HttpException(errorMsg, HttpStatus.FORBIDDEN);
        }
      }

      // Step 3: Process and upload
      const result = await this.cdnService.uploadContent(file, options);

      this.logger.log(`Successfully uploaded content: ${result.contentId}`);
      return result;
    } catch (error) {
      this.logger.error('Upload failed:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('validate')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Validate file without uploading' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'File validation result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        mimeType: { type: 'string' },
        fileType: { type: 'string' },
        size: { type: 'number' },
        maxSize: { type: 'number' },
        errors: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
        metadata: {
          type: 'object',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' },
            format: { type: 'string' },
            hasAlpha: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'No file provided' })
  async validateFile(@UploadedFile() file: FileUpload): Promise<FileValidationResult> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    this.logger.log(`Validating file: ${file.originalname}`);
    return this.fileValidation.validateFile(file);
  }

  @Post('scan')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Scan file for malware without uploading' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Malware scan result',
    schema: {
      type: 'object',
      properties: {
        clean: { type: 'boolean' },
        threats: { type: 'array', items: { type: 'string' } },
        scanTime: { type: 'number' },
        scannerVersion: { type: 'string' },
        error: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'No file provided' })
  @ApiResponse({ status: 503, description: 'Scanning service not available' })
  async scanFile(@UploadedFile() file: FileUpload) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!this.malwareScanning.isScanningAvailable()) {
      throw new HttpException(
        'Malware scanning service not available',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    this.logger.log(`Scanning file: ${file.originalname}`);
    return this.malwareScanning.scanFile(file);
  }

  @Get('allowed-types')
  @ApiOperation({ summary: 'Get allowed file types and size limits' })
  @ApiResponse({
    status: 200,
    description: 'Allowed file types and limits',
    schema: {
      type: 'object',
      properties: {
        allowedTypes: { type: 'object' },
        sizeLimits: { type: 'object' },
        dimensionLimits: { type: 'object' },
      },
    },
  })
  getAllowedTypes() {
    return {
      allowedTypes: ALLOWED_FILE_TYPES,
      sizeLimits: {
        image: this.formatBytes(FILE_SIZE_LIMITS.IMAGE_MAX_SIZE),
        video: this.formatBytes(FILE_SIZE_LIMITS.VIDEO_MAX_SIZE),
        document: this.formatBytes(FILE_SIZE_LIMITS.DOCUMENT_MAX_SIZE),
        audio: this.formatBytes(FILE_SIZE_LIMITS.AUDIO_MAX_SIZE),
        archive: this.formatBytes(FILE_SIZE_LIMITS.ARCHIVE_MAX_SIZE),
        default: this.formatBytes(FILE_SIZE_LIMITS.DEFAULT_MAX_SIZE),
      },
      dimensionLimits: {
        minWidth: 1,
        minHeight: 1,
        maxWidth: 16384,
        maxHeight: 16384,
        maxPixels: 100_000_000,
      },
    };
  }

  @Post('compress-preview')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Preview image compression without saving' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Compression preview result',
    schema: {
      type: 'object',
      properties: {
        originalSize: { type: 'number' },
        compressedSize: { type: 'number' },
        compressionRatio: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        format: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file or not an image' })
  async compressPreview(@UploadedFile() file: FileUpload) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File is not an image');
    }

    try {
      const result = await this.imageProcessing.compressImage(file.buffer);
      return {
        originalSize: result.originalSize,
        compressedSize: result.size,
        compressionRatio: result.compressionRatio,
        width: result.width,
        height: result.height,
        format: result.format,
      };
    } catch (error) {
      this.logger.error('Compression preview failed:', error);
      throw new BadRequestException('Failed to compress image');
    }
  }

  @Get('content/:contentId')
  @ApiOperation({ summary: 'Get optimized content URL' })
  @ApiParam({ name: 'contentId', description: 'Content identifier' })
  @ApiQuery({ name: 'optimize', required: false, type: Boolean })
  @ApiQuery({ name: 'width', required: false, type: Number })
  @ApiQuery({ name: 'height', required: false, type: Number })
  @ApiQuery({ name: 'quality', required: false, type: Number })
  @ApiQuery({ name: 'format', required: false, enum: ['webp', 'jpeg', 'png'] })
  @ApiQuery({ name: 'userLocation', required: false, type: String })
  @ApiQuery({ name: 'bandwidth', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Content URL retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Content not found' })
  async getContentUrl(
    @Param('contentId') contentId: string,
    @Query('optimize') optimize?: string,
    @Query('width') width?: string,
    @Query('height') height?: string,
    @Query('quality') quality?: string,
    @Query('format') format?: 'webp' | 'jpeg' | 'png',
    @Query('userLocation') userLocation?: string,
    @Query('bandwidth') bandwidth?: string,
  ): Promise<{ url: string; metadata?: any }> {
    try {
      const options = {
        optimize: optimize === 'true',
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        quality: quality ? parseInt(quality) : undefined,
        format,
        userLocation,
        bandwidth: bandwidth ? parseFloat(bandwidth) : undefined,
      };

      const url = await this.cdnService.deliverContent(contentId, options);

      return { url };
    } catch (error) {
      this.logger.error(`Failed to get content URL for ${contentId}:`, error);
      if (error.message.includes('not found')) {
        throw new HttpException('Content not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException('Failed to retrieve content', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('content/:contentId')
  @ApiOperation({ summary: 'Invalidate content cache' })
  @ApiParam({ name: 'contentId', description: 'Content identifier' })
  @ApiResponse({ status: 200, description: 'Content cache invalidated successfully' })
  @ApiResponse({ status: 404, description: 'Content not found' })
  async invalidateContent(@Param('contentId') contentId: string): Promise<{ success: boolean }> {
    try {
      await this.cdnService.invalidateContent(contentId);
      this.logger.log(`Invalidated cache for content: ${contentId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to invalidate content ${contentId}:`, error);
      throw new HttpException('Failed to invalidate content', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Check CDN health status' })
  @ApiResponse({ status: 200, description: 'CDN health status' })
  async getHealth(): Promise<{
    status: string;
    providers: Record<string, boolean>;
    timestamp: string;
  }> {
    try {
      // In a real implementation, check actual provider connectivity
      const providers = {
        cloudflare: true, // Mock health check
        aws: true,
      };

      return {
        status: 'healthy',
        providers,
        timestamp: new Date().toISOString(),
      };
    } catch (_error) {
      console.error('health check failed');
      throw new HttpException('Health check failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get CDN analytics' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'CDN analytics data' })
  async getAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    try {
      const start = startDate
        ? new Date(startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      // In a real implementation, aggregate analytics from providers
      return {
        totalRequests: 0,
        totalBandwidth: 0,
        cacheHitRate: 0,
        topContent: [],
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      };
    } catch (_error) {
      console.error('failed to retrieve');
      throw new HttpException('Failed to retrieve analytics', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
