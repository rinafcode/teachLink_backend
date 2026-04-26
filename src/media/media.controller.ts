import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Get,
  Param,
  Req,
  HttpException,
  HttpStatus,
  Logger,
  Body,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from '../common/constants/throttle.constants';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MediaService } from './media.service';
import { UploadedFile as FileUpload } from '../common/types/file.types';
import {
  buildUploadValidationDetails,
  MEDIA_UPLOAD_INTERCEPTOR_OPTIONS,
} from './validation/upload-validation.util';

@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @Throttle({ default: THROTTLE.MODERATE })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', MEDIA_UPLOAD_INTERCEPTOR_OPTIONS))
  @ApiOperation({ summary: 'Upload media file with full validation' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Media file upload',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload',
        },
        compress: {
          type: 'boolean',
          description: 'Compress images automatically',
          default: true,
        },
        generateThumbnails: {
          type: 'boolean',
          description: 'Generate thumbnails for images',
          default: true,
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 403, description: 'Malware detected' })
  @ApiResponse({ status: 413, description: 'File too large' })
  @ApiResponse({ status: 415, description: 'Unsupported file type' })
  @ApiResponse({ status: 503, description: 'Malware scanning unavailable' })
  async upload(
    @UploadedFile() file: FileUpload,
    @Req() req: any,
    @Body() body?: { compress?: string; generateThumbnails?: string },
  ) {
    if (req.uploadValidationError) {
      throw new UnsupportedMediaTypeException({
        message: req.uploadValidationError.message,
        ...buildUploadValidationDetails(),
      });
    }

    if (!file) {
      throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
    }

    const user = req.user;
    this.logger.log(`User ${user?.id} uploading file ${file.originalname}`);

    const options = {
      compress: body?.compress !== 'false',
      generateThumbnails: body?.generateThumbnails !== 'false',
      trackProgress: true,
    };

    const result = await this.mediaService.createFromUpload(
      user?.id,
      user?.tenantId,
      file,
      options,
    );

    return result;
  }

  @Get('uploads/progress/:uploadId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get upload progress by ID' })
  @ApiParam({ name: 'uploadId', description: 'Upload tracking ID' })
  @ApiResponse({ status: 200, description: 'Upload progress', type: Object })
  @ApiResponse({ status: 404, description: 'Upload not found' })
  async getUploadProgress(@Param('uploadId') uploadId: string) {
    const progress = await this.mediaService.getUploadProgress(uploadId);
    if (!progress) {
      throw new HttpException('Upload not found', HttpStatus.NOT_FOUND);
    }
    return progress;
  }

  @Get('uploads/active')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List active uploads' })
  @ApiResponse({ status: 200, description: 'List of active uploads' })
  async listActiveUploads() {
    return this.mediaService.listActiveUploads();
  }

  @Get('uploads/statistics')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get upload statistics' })
  @ApiResponse({ status: 200, description: 'Upload statistics' })
  async getUploadStatistics() {
    return this.mediaService.getUploadStatistics();
  }

  @Get(':contentId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get media metadata by content ID' })
  @ApiParam({ name: 'contentId', description: 'Content identifier' })
  @ApiResponse({ status: 200, description: 'Media metadata' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getMetadata(@Param('contentId') contentId: string, @Req() req: any) {
    const user = req.user;
    const meta = await this.mediaService.findByContentId(contentId);
    if (!meta) throw new HttpException('Not found', HttpStatus.NOT_FOUND);

    // Access control: owner or same tenant or admin
    if (
      meta.ownerId &&
      meta.ownerId !== user?.id &&
      user?.role !== 'admin' &&
      meta.tenantId !== user?.tenantId
    ) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    return meta;
  }
}
