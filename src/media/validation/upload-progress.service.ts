import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { UPLOAD_PROGRESS_CONFIG } from './file-validation.constants';

export interface UploadProgress {
  uploadId: string;
  status:
    | 'pending'
    | 'validating'
    | 'scanning'
    | 'processing'
    | 'uploading'
    | 'completed'
    | 'failed';
  progress: number; // 0-100
  fileName: string;
  fileSize: number;
  bytesProcessed: number;
  stage: string;
  message: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  result?: {
    contentId?: string;
    url?: string;
    thumbnails?: string[];
  };
}

export interface ProgressUpdate {
  status?: UploadProgress['status'];
  progress?: number;
  stage?: string;
  message?: string;
  bytesProcessed?: number;
  error?: string;
  result?: UploadProgress['result'];
}

@Injectable()
export class UploadProgressService {
  private readonly logger = new Logger(UploadProgressService.name);
  private readonly redis: Redis;

  constructor() {
    // Initialize Redis client
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.redis.on('error', () => {
      // Prevent unhandled error events during Redis outages
    });
  }

  /**
   * Initialize upload progress tracking
   */
  async initializeUpload(
    uploadId: string,
    fileName: string,
    fileSize: number,
  ): Promise<UploadProgress> {
    const progress: UploadProgress = {
      uploadId,
      status: 'pending',
      progress: 0,
      fileName,
      fileSize,
      bytesProcessed: 0,
      stage: 'initialized',
      message: 'Upload initialized',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveProgress(uploadId, progress);
    this.logger.log(`Initialized upload tracking for ${uploadId}: ${fileName}`);

    return progress;
  }

  /**
   * Update upload progress
   */
  async updateProgress(uploadId: string, update: ProgressUpdate): Promise<UploadProgress> {
    const existing = await this.getProgress(uploadId);
    if (!existing) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    const progress: UploadProgress = {
      ...existing,
      ...update,
      updatedAt: new Date().toISOString(),
    };

    // Ensure progress stays within bounds
    if (progress.progress !== undefined) {
      progress.progress = Math.max(0, Math.min(100, progress.progress));
    }

    // Mark as completed if progress is 100%
    if (progress.progress === 100 && progress.status !== 'failed') {
      progress.status = 'completed';
      progress.completedAt = new Date().toISOString();
    }

    await this.saveProgress(uploadId, progress);
    return progress;
  }

  /**
   * Get upload progress
   */
  async getProgress(uploadId: string): Promise<UploadProgress | null> {
    try {
      const key = this.getRedisKey(uploadId);
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as UploadProgress;
    } catch (error) {
      this.logger.error(`Failed to get progress for ${uploadId}:`, error);
      return null;
    }
  }

  /**
   * Mark upload as failed
   */
  async markFailed(uploadId: string, error: string): Promise<UploadProgress> {
    return this.updateProgress(uploadId, {
      status: 'failed',
      progress: 0,
      stage: 'failed',
      message: `Upload failed: ${error}`,
      error,
    });
  }

  /**
   * Mark upload as completed
   */
  async markCompleted(uploadId: string, result: UploadProgress['result']): Promise<UploadProgress> {
    return this.updateProgress(uploadId, {
      status: 'completed',
      progress: 100,
      stage: 'completed',
      message: 'Upload completed successfully',
      result,
    });
  }

  /**
   * Delete upload progress (cleanup)
   */
  async deleteProgress(uploadId: string): Promise<void> {
    const key = this.getRedisKey(uploadId);
    await this.redis.del(key);
    this.logger.log(`Deleted upload progress for ${uploadId}`);
  }

  /**
   * List active uploads
   */
  async listActiveUploads(): Promise<UploadProgress[]> {
    try {
      const pattern = `${UPLOAD_PROGRESS_CONFIG.REDIS_KEY_PREFIX}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        return [];
      }

      const values = await this.redis.mget(...keys);
      const uploads: UploadProgress[] = [];

      for (const value of values) {
        if (value) {
          const progress = JSON.parse(value) as UploadProgress;
          // Only include non-completed and non-failed uploads
          if (progress.status !== 'completed' && progress.status !== 'failed') {
            uploads.push(progress);
          }
        }
      }

      return uploads.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    } catch (error) {
      this.logger.error('Failed to list active uploads:', error);
      return [];
    }
  }

  /**
   * Cleanup old completed uploads
   */
  async cleanupOldUploads(maxAgeHours: number = 24): Promise<number> {
    try {
      const pattern = `${UPLOAD_PROGRESS_CONFIG.REDIS_KEY_PREFIX}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      const values = await this.redis.mget(...keys);
      const now = new Date().getTime();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      let deletedCount = 0;

      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (value) {
          const progress = JSON.parse(value) as UploadProgress;
          const updatedAt = new Date(progress.updatedAt).getTime();

          // Delete if old and completed/failed
          if (
            (progress.status === 'completed' || progress.status === 'failed') &&
            now - updatedAt > maxAgeMs
          ) {
            await this.redis.del(keys[i]);
            deletedCount++;
          }
        }
      }

      this.logger.log(`Cleaned up ${deletedCount} old upload records`);
      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup old uploads:', error);
      return 0;
    }
  }

  /**
   * Get upload statistics
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    validating: number;
    scanning: number;
    processing: number;
    uploading: number;
    completed: number;
    failed: number;
  }> {
    try {
      const pattern = `${UPLOAD_PROGRESS_CONFIG.REDIS_KEY_PREFIX}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        return {
          total: 0,
          pending: 0,
          validating: 0,
          scanning: 0,
          processing: 0,
          uploading: 0,
          completed: 0,
          failed: 0,
        };
      }

      const values = await this.redis.mget(...keys);
      const stats = {
        total: 0,
        pending: 0,
        validating: 0,
        scanning: 0,
        processing: 0,
        uploading: 0,
        completed: 0,
        failed: 0,
      };

      for (const value of values) {
        if (value) {
          const progress = JSON.parse(value) as UploadProgress;
          stats.total++;
          stats[progress.status]++;
        }
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get upload statistics:', error);
      return {
        total: 0,
        pending: 0,
        validating: 0,
        scanning: 0,
        processing: 0,
        uploading: 0,
        completed: 0,
        failed: 0,
      };
    }
  }

  /**
   * Save progress to Redis
   */
  private async saveProgress(uploadId: string, progress: UploadProgress): Promise<void> {
    const key = this.getRedisKey(uploadId);
    await this.redis.setex(key, UPLOAD_PROGRESS_CONFIG.EXPIRY_SECONDS, JSON.stringify(progress));
  }

  /**
   * Get Redis key for upload
   */
  private getRedisKey(uploadId: string): string {
    return `${UPLOAD_PROGRESS_CONFIG.REDIS_KEY_PREFIX}${uploadId}`;
  }
}
