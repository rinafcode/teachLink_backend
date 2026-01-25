import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

@Injectable()
export class FileStorageService {
  private uploadDir = join(process.cwd(), 'uploads');

  constructor() {
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async store(file: Express.Multer.File) {
    // File is already stored by Multer (diskStorage)
    return {
      filename: file.filename,
      path: file.path,
    };
  }

  // TODO: Replace with AWS S3 or cloud storage provider
}
