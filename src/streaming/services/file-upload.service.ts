import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import sharp from 'sharp';

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface FileMetadata {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
  category: FileCategory;
}

export enum FileCategory {
  AVATAR = 'avatar',
  DOCUMENT = 'document',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  RECORDING = 'recording',
  WHITEBOARD = 'whiteboard',
}

@Injectable()
export class FileUploadService {
  private readonly uploadDir = 'uploads';
  private readonly maxFileSize = 100 * 1024 * 1024; // 100MB
  private readonly allowedMimeTypes = {
    [FileCategory.AVATAR]: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ],
    [FileCategory.DOCUMENT]: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
    ],
    [FileCategory.IMAGE]: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ],
    [FileCategory.VIDEO]: [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/avi',
      'video/mov',
    ],
    [FileCategory.AUDIO]: [
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/aac',
      'audio/m4a',
    ],
    [FileCategory.RECORDING]: ['video/mp4', 'video/webm'],
    [FileCategory.WHITEBOARD]: ['image/png', 'image/jpeg', 'application/json'],
  };

  constructor() {
    this.ensureUploadDirectories();
  }

  private async ensureUploadDirectories(): Promise<void> {
    const categories = Object.values(FileCategory);

    for (const category of categories) {
      const dir = path.join(this.uploadDir, category);
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  async uploadFile(
    file: UploadedFile,
    category: FileCategory,
    userId: string,
    options?: {
      resize?: { width: number; height: number };
      compress?: boolean;
    },
  ): Promise<FileMetadata> {
    // Validate file
    this.validateFile(file, category);

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const filename = `${crypto.randomUUID()}${fileExtension}`;
    const categoryDir = path.join(this.uploadDir, category);
    const filePath = path.join(categoryDir, filename);

    let processedBuffer = file.buffer;

    // Process image files
    if (category === FileCategory.AVATAR || category === FileCategory.IMAGE) {
      processedBuffer = await this.processImage(file.buffer, options);
    }

    // Save file
    await fs.writeFile(filePath, processedBuffer);

    const fileMetadata: FileMetadata = {
      id: crypto.randomUUID(),
      originalName: file.originalname,
      filename,
      mimetype: file.mimetype,
      size: processedBuffer.length,
      path: filePath,
      url: `/api/files/${category}/${filename}`,
      uploadedBy: userId,
      uploadedAt: new Date(),
      category,
    };

    // In a real implementation, you would save this to a database
    // For now, we'll return the metadata
    return fileMetadata;
  }

  private validateFile(file: UploadedFile, category: FileCategory): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    const allowedTypes = this.allowedMimeTypes[category];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} not allowed for category ${category}`,
      );
    }

    // Additional security checks
    if (this.isExecutableFile(file.originalname)) {
      throw new BadRequestException('Executable files are not allowed');
    }
  }

  private isExecutableFile(filename: string): boolean {
    const executableExtensions = [
      '.exe',
      '.bat',
      '.cmd',
      '.com',
      '.scr',
      '.pif',
      '.js',
      '.vbs',
      '.jar',
    ];
    const extension = path.extname(filename).toLowerCase();
    return executableExtensions.includes(extension);
  }

  private async processImage(
    buffer: Buffer,
    options?: {
      resize?: { width: number; height: number };
      compress?: boolean;
    },
  ): Promise<Buffer> {
    let image = sharp(buffer);

    if (options?.resize) {
      image = image.resize(options.resize.width, options.resize.height, {
        fit: 'cover',
        position: 'center',
      });
    }

    if (options?.compress) {
      image = image.jpeg({ quality: 80 });
    }

    return image.toBuffer();
  }

  async getFile(
    category: FileCategory,
    filename: string,
  ): Promise<{ buffer: Buffer; mimetype: string }> {
    const filePath = path.join(this.uploadDir, category, filename);

    try {
      const buffer = await fs.readFile(filePath);
      const mimetype = this.getMimetypeFromExtension(path.extname(filename));

      return { buffer, mimetype };
    } catch (error) {
      throw new NotFoundException('File not found');
    }
  }

  private getMimetypeFromExtension(extension: string): string {
    const mimetypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mp3',
      '.wav': 'audio/wav',
    };

    return mimetypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  async deleteFile(category: FileCategory, filename: string): Promise<void> {
    const filePath = path.join(this.uploadDir, category, filename);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      throw new NotFoundException('File not found');
    }
  }

  async uploadAvatar(
    file: UploadedFile,
    userId: string,
  ): Promise<FileMetadata> {
    return this.uploadFile(file, FileCategory.AVATAR, userId, {
      resize: { width: 200, height: 200 },
      compress: true,
    });
  }

  async uploadDocument(
    file: UploadedFile,
    userId: string,
  ): Promise<FileMetadata> {
    return this.uploadFile(file, FileCategory.DOCUMENT, userId);
  }

  async uploadRecording(
    file: UploadedFile,
    userId: string,
  ): Promise<FileMetadata> {
    return this.uploadFile(file, FileCategory.RECORDING, userId);
  }

  async getFileStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByCategory: Record<FileCategory, number>;
  }> {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      filesByCategory: {} as Record<FileCategory, number>,
    };

    for (const category of Object.values(FileCategory)) {
      const categoryDir = path.join(this.uploadDir, category);
      try {
        const files = await fs.readdir(categoryDir);
        stats.filesByCategory[category] = files.length;
        stats.totalFiles += files.length;

        for (const file of files) {
          const filePath = path.join(categoryDir, file);
          const stat = await fs.stat(filePath);
          stats.totalSize += stat.size;
        }
      } catch (error) {
        stats.filesByCategory[category] = 0;
      }
    }

    return stats;
  }
}
