import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface TranscodeResult {
  success: boolean;
  outputPath: string;
  fileSize: number;
  duration: number;
  bitrate: number;
  width: number;
  height: number;
  codec: string;
}

export interface EncodingSettings {
  width: number;
  height: number;
  bitrate: string;
  crf: number;
  codec: string;
  container: string;
}

@Injectable()
export class FFmpegService {
  private readonly logger = new Logger(FFmpegService.name);

  async transcode(
    inputPath: string,
    outputPath: string,
    settings: EncodingSettings,
    onProgress?: (progress: number) => void,
  ): Promise<TranscodeResult> {
    this.logger.log(`Starting transcode: ${inputPath} -> ${outputPath}`);

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      const args = this.buildFFmpegArgs(inputPath, outputPath, settings);

      this.logger.debug(`FFmpeg command: ffmpeg ${args.join(' ')}`);

      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();

        // Parse progress from FFmpeg output
        if (onProgress) {
          const progress = this.parseProgress(stderr);
          if (progress !== null) {
            onProgress(progress);
          }
        }
      });

      ffmpeg.on('close', async (code) => {
        if (code === 0) {
          try {
            const result = await this.getTranscodeResult(outputPath, settings);
            this.logger.log(`Transcode completed: ${outputPath}`);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        } else {
          this.logger.error(`FFmpeg process exited with code ${code}`);
          this.logger.error(`FFmpeg stderr: ${stderr}`);
          reject(new Error(`FFmpeg process failed with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        this.logger.error(`FFmpeg process error: ${error.message}`);
        reject(error);
      });
    });
  }

  async generateHLS(inputPaths: string[], outputPath: string): Promise<void> {
    this.logger.log(`Generating HLS manifest: ${outputPath}`);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      const args = [
        '-y', // Overwrite output files
        ...inputPaths.flatMap((path) => ['-i', path]),
        '-c:v',
        'copy',
        '-c:a',
        'copy',
        '-f',
        'hls',
        '-hls_time',
        '10',
        '-hls_playlist_type',
        'vod',
        '-hls_segment_filename',
        `${path.dirname(outputPath)}/segment_%03d.ts`,
        '-master_pl_name',
        'master.m3u8',
        outputPath,
      ];

      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          this.logger.log(`HLS generation completed: ${outputPath}`);
          resolve();
        } else {
          this.logger.error(`HLS generation failed with code ${code}`);
          this.logger.error(`FFmpeg stderr: ${stderr}`);
          reject(new Error(`HLS generation failed with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        this.logger.error(`HLS generation error: ${error.message}`);
        reject(error);
      });
    });
  }

  async generateDASH(inputPaths: string[], outputPath: string): Promise<void> {
    this.logger.log(`Generating DASH manifest: ${outputPath}`);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      const args = [
        '-y', // Overwrite output files
        ...inputPaths.flatMap((path) => ['-i', path]),
        '-c:v',
        'copy',
        '-c:a',
        'copy',
        '-f',
        'dash',
        '-seg_duration',
        '10',
        '-adaptation_sets',
        'id=0,streams=v id=1,streams=a',
        outputPath,
      ];

      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          this.logger.log(`DASH generation completed: ${outputPath}`);
          resolve();
        } else {
          this.logger.error(`DASH generation failed with code ${code}`);
          this.logger.error(`FFmpeg stderr: ${stderr}`);
          reject(new Error(`DASH generation failed with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        this.logger.error(`DASH generation error: ${error.message}`);
        reject(error);
      });
    });
  }

  private buildFFmpegArgs(
    inputPath: string,
    outputPath: string,
    settings: EncodingSettings,
  ): string[] {
    const args = [
      '-y', // Overwrite output files
      '-i',
      inputPath,
      '-c:v',
      settings.codec,
      '-crf',
      settings.crf.toString(),
      '-b:v',
      settings.bitrate,
      '-maxrate',
      (Number.parseInt(settings.bitrate) * 1.5).toString() + 'k',
      '-bufsize',
      (Number.parseInt(settings.bitrate) * 2).toString() + 'k',
      '-vf',
      `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease,pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2`,
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      '-preset',
      'medium',
      '-progress',
      'pipe:2',
      outputPath,
    ];

    return args;
  }

  private parseProgress(stderr: string): number | null {
    const lines = stderr.split('\n');
    let duration: number | null = null;
    let time: number | null = null;

    for (const line of lines) {
      if (line.includes('Duration:')) {
        const match = line.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (match) {
          const hours = Number.parseInt(match[1]);
          const minutes = Number.parseInt(match[2]);
          const seconds = Number.parseFloat(match[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }
      }

      if (line.includes('time=')) {
        const match = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (match) {
          const hours = Number.parseInt(match[1]);
          const minutes = Number.parseInt(match[2]);
          const seconds = Number.parseFloat(match[3]);
          time = hours * 3600 + minutes * 60 + seconds;
        }
      }
    }

    if (duration && time) {
      return Math.min(Math.round((time / duration) * 100), 100);
    }

    return null;
  }

  private async getTranscodeResult(
    outputPath: string,
    settings: EncodingSettings,
  ): Promise<TranscodeResult> {
    const stats = await fs.stat(outputPath);

    // In a real implementation, you would probe the output file to get actual values
    // For now, we'll return the expected values based on settings
    return {
      success: true,
      outputPath,
      fileSize: stats.size,
      duration: 0, // Would be probed from actual file
      bitrate: Number.parseInt(settings.bitrate) * 1000,
      width: settings.width,
      height: settings.height,
      codec: settings.codec,
    };
  }
}
