import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storagePath: string;

  constructor(private readonly configService: ConfigService) {
    this.storagePath = this.configService.get<string>(
      'STORAGE_PATH',
      './storage',
    );
  }

  async saveFile(buffer: Buffer, filePath: string): Promise<string> {
    const fullPath = path.join(this.storagePath, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    this.logger.log(`File saved: ${fullPath}`);
    return fullPath;
  }

  async getFile(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.storagePath, filePath);
    return await fs.readFile(fullPath);
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.storagePath, filePath);
    await fs.unlink(fullPath);
    this.logger.log(`File deleted: ${fullPath}`);
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.storagePath, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getFileSize(filePath: string): Promise<number> {
    const fullPath = path.join(this.storagePath, filePath);
    const stats = await fs.stat(fullPath);
    return stats.size;
  }

  getFullPath(filePath: string): string {
    return path.join(this.storagePath, filePath);
  }
}
