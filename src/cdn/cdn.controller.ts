import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiResponse } from '@nestjs/swagger';
import { fileTypeFromBuffer } from 'file-type';
import { UploadContentDto } from './dto/upload-content.dto';
import {
  FILE_SIZE_LIMITS,
  ALL_ALLOWED_FILE_TYPES,
} from '../media/validation/file-validation.constants';

@ApiTags('cdn')
@Controller('cdn')
export class CdnController {
  private readonly logger = new Logger(CdnController.name);

  @Post('upload')
  @ApiOperation({ summary: 'Upload content to CDN' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 413, description: 'File too large' })
  @ApiResponse({ status: 415, description: 'Unsupported media type' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: FILE_SIZE_LIMITS.VIDEO_MAX_SIZE, // Max limit for videos
      },
    }),
  )
  async uploadContent(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file size based on detected type
    const detectedType = await this.detectFileType(file.buffer);
    const maxSize = this.getMaxSizeForType(detectedType?.mime || file.mimetype);

    if (file.size > maxSize) {
      this.logger.warn(
        `File upload rejected: size ${file.size} exceeds limit ${maxSize} for type ${detectedType?.mime || file.mimetype}`,
      );
      throw new PayloadTooLargeException(
        `File size ${Math.round(file.size / 1024 / 1024)}MB exceeds maximum allowed size of ${Math.round(maxSize / 1024 / 1024)}MB for this file type`,
      );
    }

    // Validate MIME type using magic bytes
    if (!detectedType) {
      throw new UnsupportedMediaTypeException(
        'Could not determine file type from content. File may be corrupted or format not supported.',
      );
    }

    const declaredMimeType = file.mimetype.toLowerCase();
    const detectedMimeType = detectedType.mime.toLowerCase();

    // Check if detected MIME type is in allowed list
    if (!ALL_ALLOWED_FILE_TYPES.includes(detectedMimeType)) {
      throw new UnsupportedMediaTypeException(
        `Detected file type "${detectedMimeType}" is not allowed. Allowed types: ${ALL_ALLOWED_FILE_TYPES.join(', ')}`,
      );
    }

    // Compare declared vs detected MIME type
    if (declaredMimeType !== detectedMimeType) {
      this.logger.warn(
        `MIME type mismatch: declared="${declaredMimeType}", detected="${detectedMimeType}"`,
      );
      throw new UnsupportedMediaTypeException(
        `Declared MIME type "${declaredMimeType}" does not match actual file content "${detectedMimeType}"`,
      );
    }

    // If we get here, validation passed
    this.logger.log(
      `File uploaded successfully: ${file.originalname}, size: ${file.size}, type: ${detectedMimeType}`,
    );

    return {
      success: true,
      message: 'File uploaded successfully',
      file: {
        originalname: file.originalname,
        size: file.size,
        mimetype: detectedMimeType,
        extension: detectedType.ext,
      },
    };
  }

  /**
   * Detect file type from buffer using magic bytes
   */
  private async detectFileType(buffer: Buffer) {
    try {
      const fileType = await fileTypeFromBuffer(buffer);
      return fileType;
    } catch (error) {
      this.logger.error('Error detecting file type:', error);
      return null;
    }
  }

  /**
   * Get maximum file size for a given MIME type
   */
  private getMaxSizeForType(mimeType: string): number {
    const mime = mimeType.toLowerCase();

    if (mime.startsWith('image/')) {
      return FILE_SIZE_LIMITS.IMAGE_MAX_SIZE;
    }
    if (mime.startsWith('video/')) {
      return FILE_SIZE_LIMITS.VIDEO_MAX_SIZE;
    }
    if (mime.startsWith('audio/')) {
      return FILE_SIZE_LIMITS.AUDIO_MAX_SIZE;
    }
    if (mime.includes('pdf') || mime.includes('document') || mime.includes('sheet') || mime.includes('presentation')) {
      return FILE_SIZE_LIMITS.DOCUMENT_MAX_SIZE;
    }
    if (mime.includes('zip') || mime.includes('archive')) {
      return FILE_SIZE_LIMITS.ARCHIVE_MAX_SIZE;
    }

    return FILE_SIZE_LIMITS.DEFAULT_MAX_SIZE;
  }
}
