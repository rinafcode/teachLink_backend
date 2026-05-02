import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  ALL_ALLOWED_FILE_TYPES,
  MAX_UPLOAD_FILE_SIZE,
  FILE_SIZE_LIMITS,
  MAGIC_NUMBERS,
} from '../validation/file-validation.constants';

@Injectable()
export class FileUploadValidationService {
  private readonly logger = new Logger(FileUploadValidationService.name);

  /**
   * Validate file MIME type against allowed list
   */
  validateMimeType(mimetype: string): boolean {
    const normalizedMimeType = mimetype?.toLowerCase().trim() || '';
    return ALL_ALLOWED_FILE_TYPES.includes(normalizedMimeType);
  }

  /**
   * Validate file size against global and type-specific limits
   */
  validateFileSize(fileSize: number, mimetype?: string): void {
    if (fileSize > MAX_UPLOAD_FILE_SIZE) {
      throw new BadRequestException(
        `File size ${fileSize} bytes exceeds maximum allowed size of ${MAX_UPLOAD_FILE_SIZE} bytes`,
      );
    }

    if (mimetype) {
      const typeSpecificLimit = this.getTypeSpecificLimit(mimetype);
      if (fileSize > typeSpecificLimit) {
        throw new BadRequestException(
          `File size ${fileSize} bytes exceeds the limit for ${mimetype} files (${typeSpecificLimit} bytes)`,
        );
      }
    }
  }

  /**
   * Validate file magic numbers (file signature) to prevent MIME type spoofing
   */
  validateMagicNumber(buffer: Buffer, mimetype: string): boolean {
    const expectedMagicNumbers = MAGIC_NUMBERS[mimetype];

    if (!expectedMagicNumbers || expectedMagicNumbers.length === 0) {
      // If no magic number defined, allow the file
      this.logger.warn(`No magic number definition for ${mimetype}, skipping validation`);
      return true;
    }

    // Check if buffer matches any of the expected magic numbers
    return expectedMagicNumbers.some((magicNumber) => {
      if (buffer.length < magicNumber.length) {
        return false;
      }

      for (let i = 0; i < magicNumber.length; i++) {
        if (buffer[i] !== magicNumber[i]) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Scan file for malware/virus (stub implementation)
   * In production, integrate with ClamAV or similar antivirus service
   */
  async scanForMalware(fileBuffer: Buffer, fileName: string): Promise<boolean> {
    try {
      // TODO: Integrate with actual antivirus scanning service
      // Example: ClamAV, VirusTotal API, or cloud-based scanning

      this.logger.log(`Scanning file ${fileName} for malware...`);

      // Placeholder: In production, this would call an external scanning service
      // For now, we perform basic heuristic checks

      // Check for potentially dangerous file patterns
      const hasSuspiciousPatterns = this.checkSuspiciousPatterns(fileBuffer);

      if (hasSuspiciousPatterns) {
        this.logger.warn(`Suspicious patterns detected in file: ${fileName}`);
        return false;
      }

      this.logger.log(`File ${fileName} passed malware scan`);
      return true;
    } catch (error) {
      this.logger.error(`Malware scan failed for ${fileName}: ${error.message}`);
      // Fail secure: if scan fails, reject the file
      return false;
    }
  }

  /**
   * Comprehensive file validation
   */
  async validateFile(file: {
    buffer: Buffer;
    mimetype: string;
    size: number;
    originalname: string;
  }): Promise<void> {
    // 1. Validate MIME type
    if (!this.validateMimeType(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed. Allowed types: ${ALL_ALLOWED_FILE_TYPES.join(', ')}`,
      );
    }

    // 2. Validate file size
    this.validateFileSize(file.size, file.mimetype);

    // 3. Validate magic numbers (prevent MIME type spoofing)
    if (!this.validateMagicNumber(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        `File content does not match declared type "${file.mimetype}". Possible file type spoofing detected.`,
      );
    }

    // 4. Scan for malware
    const isClean = await this.scanForMalware(file.buffer, file.originalname);
    if (!isClean) {
      throw new BadRequestException(
        `File "${file.originalname}" failed security scanning and was rejected.`,
      );
    }
  }

  /**
   * Get type-specific file size limit
   */
  private getTypeSpecificLimit(mimetype: string): number {
    if (mimetype.startsWith('image/')) {
      return FILE_SIZE_LIMITS.IMAGE_MAX_SIZE;
    }
    if (mimetype.startsWith('video/')) {
      return FILE_SIZE_LIMITS.VIDEO_MAX_SIZE;
    }
    if (mimetype.startsWith('audio/')) {
      return FILE_SIZE_LIMITS.AUDIO_MAX_SIZE;
    }
    if (
      mimetype.startsWith('application/pdf') ||
      mimetype.startsWith('application/msword') ||
      mimetype.startsWith('application/vnd.')
    ) {
      return FILE_SIZE_LIMITS.DOCUMENT_MAX_SIZE;
    }
    if (mimetype.startsWith('application/zip') || mimetype.startsWith('application/x-')) {
      return FILE_SIZE_LIMITS.ARCHIVE_MAX_SIZE;
    }
    return FILE_SIZE_LIMITS.DEFAULT_MAX_SIZE;
  }

  /**
   * Check for suspicious patterns in file buffer (basic heuristic)
   */
  private checkSuspiciousPatterns(buffer: Buffer): boolean {
    // Convert buffer to string for pattern matching (for text-based files)
    const content = buffer.toString('utf8');

    // Check for common malicious patterns
    const suspiciousPatterns = [
      /<\?php\s+eval\s*\(/i, // PHP eval
      /javascript\s*:/i, // JavaScript protocol
      /on(load|error|click)\s*=/i, // Event handlers
      /<script/i, // Script tags
      /\bexec\s*\(/i, // Exec calls
      /\bsystem\s*\(/i, // System calls
      /\bpassthru\s*\(/i, // Passthru calls
      /shell_exec\s*\(/i, // Shell exec
    ];

    // Only check first 10KB for performance
    const sampleContent = content.slice(0, 10240);

    return suspiciousPatterns.some((pattern) => pattern.test(sampleContent));
  }
}
