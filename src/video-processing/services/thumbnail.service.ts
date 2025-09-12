import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);

  async generateThumbnails(
    videoPath: string,
    videoId: string,
    timestamps: number[] = [10, 25, 50, 75, 90],
  ): Promise<string[]> {
    this.logger.log(`Generating thumbnails for video: ${videoId}`);

    const thumbnailPaths: string[] = [];
    const outputDir = `thumbnails/${videoId}`;

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      const outputPath = path.join(outputDir, `thumbnail_${i + 1}.jpg`);

      try {
        await this.generateSingleThumbnail(videoPath, outputPath, timestamp);
        thumbnailPaths.push(outputPath);
      } catch (error) {
        this.logger.error(
          `Failed to generate thumbnail at ${timestamp}%: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Generated ${thumbnailPaths.length} thumbnails for video: ${videoId}`,
    );
    return thumbnailPaths;
  }

  private async generateSingleThumbnail(
    videoPath: string,
    outputPath: string,
    timestampPercent: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y', // Overwrite output files
        '-i',
        videoPath,
        '-ss',
        `${timestampPercent}%`,
        '-vframes',
        '1',
        '-vf',
        'scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2',
        '-q:v',
        '2',
        outputPath,
      ];

      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          this.logger.error(`Thumbnail generation failed with code ${code}`);
          this.logger.error(`FFmpeg stderr: ${stderr}`);
          reject(new Error(`Thumbnail generation failed with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        this.logger.error(`Thumbnail generation error: ${error.message}`);
        reject(error);
      });
    });
  }

  async generatePreview(
    videoPath: string,
    videoId: string,
    duration = 30,
  ): Promise<string> {
    this.logger.log(`Generating preview for video: ${videoId}`);

    const outputPath = `previews/${videoId}/preview.mp4`;
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      const args = [
        '-y', // Overwrite output files
        '-i',
        videoPath,
        '-t',
        duration.toString(),
        '-vf',
        'scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2',
        '-c:v',
        'libx264',
        '-crf',
        '28',
        '-c:a',
        'aac',
        '-b:a',
        '64k',
        '-movflags',
        '+faststart',
        outputPath,
      ];

      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          this.logger.log(`Preview generated successfully: ${outputPath}`);
          resolve(outputPath);
        } else {
          this.logger.error(`Preview generation failed with code ${code}`);
          this.logger.error(`FFmpeg stderr: ${stderr}`);
          reject(new Error(`Preview generation failed with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        this.logger.error(`Preview generation error: ${error.message}`);
        reject(error);
      });
    });
  }
}
