import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { FileStorageService } from '../storage/file-storage.service';

export interface VideoQuality {
  name: string;
  width: number;
  height: number;
  bitrate: string;
}

export interface TranscodeJob {
  jobId: string;
  status: 'SUBMITTED' | 'PROGRESSING' | 'COMPLETE' | 'CANCELED' | 'ERROR';
  outputs?: { [quality: string]: string };
}

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);
  private elasticTranscoder: AWS.ElasticTranscoder;
  private pipelineId: string;

  private readonly qualities: VideoQuality[] = [
    { name: '1080p', width: 1920, height: 1080, bitrate: '5000k' },
    { name: '720p', width: 1280, height: 720, bitrate: '2500k' },
    { name: '480p', width: 854, height: 480, bitrate: '1000k' },
    { name: '360p', width: 640, height: 360, bitrate: '600k' },
  ];

  constructor(
    private configService: ConfigService,
    private fileStorageService: FileStorageService,
  ) {
    this.elasticTranscoder = new AWS.ElasticTranscoder({
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get('AWS_REGION', 'us-east-1'),
    });
    this.pipelineId = this.configService.get(
      'AWS_ELASTIC_TRANSCODER_PIPELINE_ID',
    );
  }

  async transcodeVideo(
    inputKey: string,
    outputKeyPrefix: string,
  ): Promise<TranscodeJob> {
    try {
      const jobs = [];

      // Create transcoding jobs for each quality
      for (const quality of this.qualities) {
        const outputKey = `${outputKeyPrefix}_${quality.name}.mp4`;

        const jobParams = {
          PipelineId: this.pipelineId,
          Input: {
            Key: inputKey,
          },
          Output: {
            Key: outputKey,
            PresetId: this.getPresetIdForQuality(quality),
          },
        };

        const job = await this.elasticTranscoder.createJob(jobParams).promise();
        jobs.push({ quality: quality.name, jobId: job.Job.Id, outputKey });
      }

      this.logger.log(`Started transcoding jobs for ${inputKey}`);

      return {
        jobId: jobs[0].jobId, // Return the first job ID as primary
        status: 'SUBMITTED',
        outputs: jobs.reduce((acc, job) => {
          acc[job.quality] = job.outputKey;
          return acc;
        }, {}),
      };
    } catch (error) {
      this.logger.error(`Failed to start transcoding: ${error.message}`);
      throw new Error(`Video transcoding failed: ${error.message}`);
    }
  }

  async getJobStatus(jobId: string): Promise<TranscodeJob> {
    try {
      const result = await this.elasticTranscoder
        .readJob({ Id: jobId })
        .promise();

      return {
        jobId,
        status: result.Job.Status as any,
        outputs: result.Job.Outputs?.reduce(
          (acc: { [quality: string]: string }, output) => {
            const quality = this.extractQualityFromKey(output.Key);
            if (quality) {
              acc[quality] = output.Key;
            }
            return acc;
          },
          {},
        ),
      };
    } catch (error) {
      this.logger.error(`Failed to get job status: ${error.message}`);
      throw new Error(`Job status check failed: ${error.message}`);
    }
  }

  async generateThumbnail(
    inputKey: string,
    outputKey: string,
    timeOffset: number = 5,
  ): Promise<string> {
    try {
      const jobParams = {
        PipelineId: this.pipelineId,
        Input: {
          Key: inputKey,
        },
        Output: {
          Key: outputKey,
          PresetId: '1351620000001-00001', // Thumbnail preset
          ThumbnailPattern: outputKey.replace('.jpg', '_{count}.jpg'),
        },
      };

      const job = await this.elasticTranscoder.createJob(jobParams).promise();
      this.logger.log(`Started thumbnail generation for ${inputKey}`);

      return job.Job.Id;
    } catch (error) {
      this.logger.error(`Failed to generate thumbnail: ${error.message}`);
      throw new Error(`Thumbnail generation failed: ${error.message}`);
    }
  }

  private getPresetIdForQuality(quality: VideoQuality): string {
    // AWS Elastic Transcoder preset IDs for different qualities
    const presetMap = {
      '1080p': '1351620000001-000001', // System preset: Generic 1080p
      '720p': '1351620000001-000010', // System preset: Generic 720p
      '480p': '1351620000001-000020', // System preset: Generic 480p
      '360p': '1351620000001-000040', // System preset: Generic 360p
    };

    return presetMap[quality.name] || presetMap['720p'];
  }

  private extractQualityFromKey(key: string): string | null {
    const match = key.match(/_([0-9]+p)\.mp4$/);
    return match ? match[1] : null;
  }

  async createHLSPlaylist(outputKeys: {
    [quality: string]: string;
  }): Promise<string> {
    // Generate HLS playlist for adaptive bitrate streaming
    const playlistContent = this.generateM3U8Playlist(outputKeys);
    const playlistKey = `playlists/${Date.now()}_master.m3u8`;

    // Upload playlist to S3
    await this.uploadPlaylist(playlistKey, playlistContent);

    return playlistKey;
  }

  private generateM3U8Playlist(outputKeys: {
    [quality: string]: string;
  }): string {
    let playlist = '#EXTM3U\n#EXT-X-VERSION:3\n';

    for (const [quality, key] of Object.entries(outputKeys)) {
      const qualityNum = parseInt(quality.replace('p', ''));
      const bandwidth = this.getBandwidthForQuality(qualityNum);

      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${this.getResolutionForQuality(qualityNum)}\n`;
      playlist += `${key}\n`;
    }

    return playlist;
  }

  private async uploadPlaylist(key: string, content: string): Promise<void> {
    // Implementation would upload the playlist content to S3
    // This is a simplified version
  }

  private getBandwidthForQuality(quality: number): number {
    const bandwidthMap = {
      1080: 5000000,
      720: 2500000,
      480: 1000000,
      360: 600000,
    };
    return bandwidthMap[quality] || 1000000;
  }

  private getResolutionForQuality(quality: number): string {
    const resolutionMap = {
      1080: '1920x1080',
      720: '1280x720',
      480: '854x480',
      360: '640x360',
    };
    return resolutionMap[quality] || '1280x720';
  }
}
