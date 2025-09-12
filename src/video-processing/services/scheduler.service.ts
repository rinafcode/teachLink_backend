import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Repository } from 'typeorm';
import {
  type VideoProcessingJob,
  JobStatus,
} from '../entities/video-processing-job.entity';
import { type Video, VideoStatus } from '../entities/video.entity';
import type { QueueService } from './queue.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly jobRepository: Repository<VideoProcessingJob>,
    private readonly videoRepository: Repository<Video>,
    private readonly queueService: QueueService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleStuckJobs() {
    this.logger.debug('Checking for stuck jobs...');

    const stuckJobTimeout = 30 * 60 * 1000; // 30 minutes
    const stuckJobThreshold = new Date(Date.now() - stuckJobTimeout);

    const stuckJobs = await this.jobRepository.find({
      where: {
        status: JobStatus.PROCESSING,
        startedAt: { $lt: stuckJobThreshold } as any,
      },
    });

    for (const job of stuckJobs) {
      this.logger.warn(`Found stuck job: ${job.id}, marking as failed`);
      job.status = JobStatus.FAILED;
      job.error = 'Job timed out - exceeded maximum processing time';
      job.completedAt = new Date();
      await this.jobRepository.save(job);
    }

    if (stuckJobs.length > 0) {
      this.logger.log(`Marked ${stuckJobs.length} stuck jobs as failed`);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleRetryJobs() {
    this.logger.debug('Checking for jobs to retry...');

    const retryJobs = await this.jobRepository.find({
      where: {
        status: JobStatus.RETRYING,
        scheduledAt: { $lte: new Date() } as any,
      },
      take: 50, // Limit to prevent overwhelming the system
    });

    for (const job of retryJobs) {
      this.logger.log(`Retrying job: ${job.id}`);
      await this.queueService.addJob(job);
    }

    if (retryJobs.length > 0) {
      this.logger.log(`Queued ${retryJobs.length} jobs for retry`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldJobs() {
    this.logger.debug('Cleaning up old completed jobs...');

    const cleanupThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await this.jobRepository.delete({
      status: JobStatus.COMPLETED,
      completedAt: { $lt: cleanupThreshold } as any,
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(`Cleaned up ${result.affected} old completed jobs`);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async updateVideoProcessingProgress() {
    this.logger.debug('Updating video processing progress...');

    const processingVideos = await this.videoRepository.find({
      where: { status: VideoStatus.PROCESSING },
      relations: ['processingJobs'],
    });

    for (const video of processingVideos) {
      const jobs = video.processingJobs || [];
      const totalJobs = jobs.length;
      const completedJobs = jobs.filter(
        (job) => job.status === JobStatus.COMPLETED,
      ).length;
      const failedJobs = jobs.filter(
        (job) => job.status === JobStatus.FAILED,
      ).length;

      let overallProgress = 0;
      if (totalJobs > 0) {
        const jobProgress = jobs.reduce((sum, job) => sum + job.progress, 0);
        overallProgress = Math.floor(jobProgress / totalJobs);
      }

      // Update video progress
      if (video.processingProgress !== overallProgress) {
        video.processingProgress = overallProgress;
        await this.videoRepository.save(video);
      }

      // Check if all jobs are completed or failed
      if (completedJobs + failedJobs === totalJobs) {
        if (failedJobs === 0) {
          video.status = VideoStatus.COMPLETED;
          video.processingProgress = 100;
        } else if (completedJobs === 0) {
          video.status = VideoStatus.FAILED;
          video.processingError = 'All processing jobs failed';
        } else {
          video.status = VideoStatus.COMPLETED;
          video.processingProgress = 100;
          video.processingError = `${failedJobs} out of ${totalJobs} jobs failed`;
        }

        await this.videoRepository.save(video);
        this.logger.log(
          `Video ${video.id} processing completed with status: ${video.status}`,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async updateQueueStatistics() {
    this.logger.debug('Updating queue statistics...');

    const stats = await this.queueService.getQueueStats();

    for (const queueStat of stats) {
      this.logger.debug(
        `Queue ${queueStat.queueName}: ${queueStat.queuedJobs} queued, ${queueStat.processingJobs} processing, throughput: ${queueStat.throughput}/day`,
      );
    }
  }
}
