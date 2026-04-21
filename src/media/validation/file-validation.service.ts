import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import * as path from 'path';
import {
  ALLOWED_FILE_TYPES,
  ALLOWED_EXTENSIONS,
  FILE_SIZE_LIMITS,
  IMAGE_DIMENSION_LIMITS,
  MAGIC_NUMBERS,
} from './file-validation.constants';
import { UploadedFile } from '../../common/types/file.types';

export interface FileValidationResult {
  valid: boolean;
  mimeType: string;
  fileType: 'image' | 'video' | 'document' | 'audio' | 'archive' | 'unknown';
  size: number;
  maxSize: number;
  errors: string[];
  warnings: string[];
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    hasAlpha?: boolean;
  };
}

export interface ImageDimensions {
  width: number;
  height: number;
}

@Injectable()
export class FileValidationService {
  private readonly logger = new Logger(FileValidationService.name);

  private readonly allAllowedTypes: string[] = [
    ...ALLOWED_FILE_TYPES.IMAGES,
    ...ALLOWED_FILE_TYPES.VIDEOS,
    ...ALLOWED_FILE_TYPES.DOCUMENTS,
    ...ALLOWED_FILE_TYPES.AUDIO,
    ...ALLOWED_FILE_TYPES.ARCHIVES,
  ];

  private readonly allAllowedExtensions: string[] = [
    ...ALLOWED_EXTENSIONS.IMAGES,
    ...ALLOWED_EXTENSIONS.VIDEOS,
    ...ALLOWED_EXTENSIONS.DOCUMENTS,
    ...ALLOWED_EXTENSIONS.AUDIO,
    ...ALLOWED_EXTENSIONS.ARCHIVES,
  ];

  /**
   * Validate file comprehensively
   */
  async validateFile(file: UploadedFile): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check if file exists
    if (!file || !file.buffer || file.buffer.length === 0) {
      return {
        valid: false,
        mimeType: '',
        fileType: 'unknown',
        size: 0,
        maxSize: 0,
        errors: ['No file provided or file is empty'],
        warnings: [],
      };
    }

    // 2. Validate MIME type against whitelist
    const mimeValidation = this.validateMimeType(file.mimetype);
    if (!mimeValidation.valid) {
      errors.push(`File type "${file.mimetype}" is not allowed`);
    }

    // 3. Validate file extension
    const extValidation = this.validateExtension(file.originalname);
    if (!extValidation.valid) {
      errors.push(`File extension "${extValidation.extension}" is not allowed`);
    }

    // 4. Validate magic numbers (file signature)
    const signatureValidation = await this.validateFileSignature(file);
    if (!signatureValidation.valid) {
      errors.push('File signature does not match the declared type. Possible spoofing attempt.');
    }

    // 5. Get file type category
    const fileType = this.getFileType(file.mimetype);

    // 6. Validate file size
    const sizeValidation = this.validateFileSize(file.size, fileType);
    if (!sizeValidation.valid) {
      errors.push(
        `File size ${this.formatBytes(file.size)} exceeds maximum allowed ${this.formatBytes(sizeValidation.maxSize)}`,
      );
    }

    // 7. Validate image dimensions if it's an image
    let imageMetadata:
      | { width?: number; height?: number; format?: string; hasAlpha?: boolean }
      | undefined;
    if (fileType === 'image') {
      const dimValidation = await this.validateImageDimensions(file.buffer);
      if (!dimValidation.valid && dimValidation.dimensions) {
        errors.push(
          `Image dimensions (${dimValidation.dimensions.width}x${dimValidation.dimensions.height}) are outside allowed limits`,
        );
      }
      if (dimValidation.dimensions) {
        imageMetadata = {
          width: dimValidation.dimensions.width,
          height: dimValidation.dimensions.height,
          format: dimValidation.dimensions.format,
          hasAlpha: dimValidation.dimensions.hasAlpha,
        };
      }
      if (dimValidation.warnings) {
        warnings.push(...dimValidation.warnings);
      }
    }

    // 8. Check for suspicious patterns
    const securityCheck = await this.checkSecurityPatterns(file);
    if (!securityCheck.valid) {
      errors.push(...securityCheck.issues);
    }

    return {
      valid: errors.length === 0,
      mimeType: file.mimetype,
      fileType,
      size: file.size,
      maxSize: sizeValidation.maxSize,
      errors,
      warnings,
      metadata: imageMetadata,
    };
  }

  /**
   * Validate MIME type against whitelist
   */
  private validateMimeType(mimeType: string): { valid: boolean } {
    return {
      valid: this.allAllowedTypes.includes(mimeType.toLowerCase()),
    };
  }

  /**
   * Validate file extension
   */
  private validateExtension(filename: string): { valid: boolean; extension: string } {
    const ext = path.extname(filename).toLowerCase();
    return {
      valid: this.allAllowedExtensions.includes(ext),
      extension: ext,
    };
  }

  /**
   * Validate file signature (magic numbers)
   */
  private async validateFileSignature(
    file: UploadedFile,
  ): Promise<{ valid: boolean; detectedType?: string }> {
    const buffer = file.buffer;

    // Check if we have magic numbers for this MIME type
    const expectedSignatures = MAGIC_NUMBERS[file.mimetype];
    if (!expectedSignatures) {
      // No magic numbers defined for this type, skip validation
      this.logger.warn(`No magic numbers defined for MIME type: ${file.mimetype}`);
      return { valid: true };
    }

    // Check if any signature matches
    for (const signature of expectedSignatures) {
      if (buffer.length >= signature.length) {
        const fileHeader = buffer.slice(0, signature.length);
        if (fileHeader.equals(signature)) {
          return { valid: true };
        }
      }
    }

    // Special case: Office documents (docx, xlsx, pptx) are ZIP-based
    if (file.mimetype.includes('officedocument') || file.mimetype.includes('vnd.openxmlformats')) {
      const zipSignature = MAGIC_NUMBERS['application/zip'];
      if (zipSignature && buffer.length >= zipSignature[0].length) {
        const fileHeader = buffer.slice(0, zipSignature[0].length);
        if (fileHeader.equals(zipSignature[0])) {
          return { valid: true };
        }
      }
    }

    return { valid: false };
  }

  /**
   * Get file type category
   */
  private getFileType(
    mimeType: string,
  ): 'image' | 'video' | 'document' | 'audio' | 'archive' | 'unknown' {
    const normalizedMime = mimeType.toLowerCase();
    if (
      ALLOWED_FILE_TYPES.IMAGES.includes(
        normalizedMime as (typeof ALLOWED_FILE_TYPES.IMAGES)[number],
      )
    )
      return 'image';
    if (
      ALLOWED_FILE_TYPES.VIDEOS.includes(
        normalizedMime as (typeof ALLOWED_FILE_TYPES.VIDEOS)[number],
      )
    )
      return 'video';
    if (
      ALLOWED_FILE_TYPES.DOCUMENTS.includes(
        normalizedMime as (typeof ALLOWED_FILE_TYPES.DOCUMENTS)[number],
      )
    )
      return 'document';
    if (
      ALLOWED_FILE_TYPES.AUDIO.includes(normalizedMime as (typeof ALLOWED_FILE_TYPES.AUDIO)[number])
    )
      return 'audio';
    if (
      ALLOWED_FILE_TYPES.ARCHIVES.includes(
        normalizedMime as (typeof ALLOWED_FILE_TYPES.ARCHIVES)[number],
      )
    )
      return 'archive';
    return 'unknown';
  }

  /**
   * Validate file size based on type
   */
  private validateFileSize(size: number, fileType: string): { valid: boolean; maxSize: number } {
    let maxSize = FILE_SIZE_LIMITS.DEFAULT_MAX_SIZE;

    switch (fileType) {
      case 'image':
        maxSize = FILE_SIZE_LIMITS.IMAGE_MAX_SIZE;
        break;
      case 'video':
        maxSize = FILE_SIZE_LIMITS.VIDEO_MAX_SIZE;
        break;
      case 'document':
        maxSize = FILE_SIZE_LIMITS.DOCUMENT_MAX_SIZE;
        break;
      case 'audio':
        maxSize = FILE_SIZE_LIMITS.AUDIO_MAX_SIZE;
        break;
      case 'archive':
        maxSize = FILE_SIZE_LIMITS.ARCHIVE_MAX_SIZE;
        break;
    }

    return {
      valid: size <= maxSize,
      maxSize,
    };
  }

  /**
   * Validate image dimensions
   */
  async validateImageDimensions(buffer: Buffer): Promise<{
    valid: boolean;
    dimensions?: ImageDimensions & { format?: string; hasAlpha?: boolean };
    warnings?: string[];
  }> {
    try {
      const metadata = await sharp(buffer).metadata();

      if (!metadata.width || !metadata.height) {
        return {
          valid: false,
          warnings: ['Could not determine image dimensions'],
        };
      }

      const warnings: string[] = [];
      const { MIN_WIDTH, MIN_HEIGHT, MAX_WIDTH, MAX_HEIGHT, MAX_PIXELS } = IMAGE_DIMENSION_LIMITS;

      // Check minimum dimensions
      if (metadata.width < MIN_WIDTH || metadata.height < MIN_HEIGHT) {
        return {
          valid: false,
          dimensions: {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            hasAlpha: metadata.hasAlpha,
          },
        };
      }

      // Check maximum dimensions
      if (metadata.width > MAX_WIDTH || metadata.height > MAX_HEIGHT) {
        return {
          valid: false,
          dimensions: {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            hasAlpha: metadata.hasAlpha,
          },
        };
      }

      // Check total pixel count
      const totalPixels = metadata.width * metadata.height;
      if (totalPixels > MAX_PIXELS) {
        warnings.push(`Image has ${totalPixels.toLocaleString()} pixels, which is very large`);
      }

      // Warn about very large dimensions
      if (metadata.width > 8192 || metadata.height > 8192) {
        warnings.push('Image dimensions are very large and may cause performance issues');
      }

      return {
        valid: true,
        dimensions: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          hasAlpha: metadata.hasAlpha,
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to validate image dimensions:', error);
      return {
        valid: false,
        warnings: ['Failed to read image metadata'],
      };
    }
  }

  /**
   * Check for security patterns in file
   */
  private async checkSecurityPatterns(
    file: UploadedFile,
  ): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check for double extensions (e.g., file.jpg.exe)
    const basename = path.basename(file.originalname, path.extname(file.originalname));
    if (path.extname(basename)) {
      issues.push('File has multiple extensions which may indicate malicious intent');
    }

    // Check for null bytes in filename
    if (file.originalname.includes('\x00')) {
      issues.push('Filename contains null bytes');
    }

    // Check for path traversal
    if (
      file.originalname.includes('..') ||
      file.originalname.includes('/') ||
      file.originalname.includes('\\')
    ) {
      issues.push('Filename contains path traversal characters');
    }

    // Check for control characters
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f-\x9f]/.test(file.originalname)) {
      issues.push('Filename contains control characters');
    }

    // Check file content for executable signatures (basic check)
    const executableSignatures = [
      Buffer.from([0x4d, 0x5a]), // Windows executable (MZ header)
      Buffer.from([0x7f, 0x45, 0x4c, 0x46]), // ELF (Linux executable)
      Buffer.from([0xca, 0xfe, 0xba, 0xbe]), // Java class file
      Buffer.from([0xcf, 0xfa, 0xed, 0xfe]), // macOS Mach-O
    ];

    for (const signature of executableSignatures) {
      if (file.buffer.length >= signature.length) {
        const fileHeader = file.buffer.slice(0, signature.length);
        if (fileHeader.equals(signature)) {
          issues.push('File appears to be an executable, which is not allowed');
          break;
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
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

  /**
   * Quick validation for controller use
   */
  async quickValidate(file: UploadedFile): Promise<void> {
    const result = await this.validateFile(file);
    if (!result.valid) {
      throw new BadRequestException({
        message: 'File validation failed',
        errors: result.errors,
        warnings: result.warnings,
      });
    }
  }
}
