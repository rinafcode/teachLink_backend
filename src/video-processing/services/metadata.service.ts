import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  codec: string;
  bitrate: number;
  format: string;
  size: number;
}

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);

  async extractMetadata(filePath: string): Promise<VideoMetadata> {
    this.logger.log(`Extracting metadata from: ${filePath}`);

    return new Promise((resolve, reject) => {
      const args = [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        filePath,
      ];

      const ffprobe = spawn('ffprobe', args);
      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const metadata = this.parseMetadata(JSON.parse(stdout));
            this.logger.log(`Metadata extracted successfully for: ${filePath}`);
            resolve(metadata);
          } catch (error) {
            this.logger.error(`Failed to parse metadata: ${error.message}`);
            reject(error);
          }
        } else {
          this.logger.error(`FFprobe process exited with code ${code}`);
          this.logger.error(`FFprobe stderr: ${stderr}`);
          reject(new Error(`FFprobe process failed with code ${code}`));
        }
      });

      ffprobe.on('error', (error) => {
        this.logger.error(`FFprobe process error: ${error.message}`);
        reject(error);
      });
    });
  }

  private parseMetadata(probeData: any): VideoMetadata {
    const videoStream = probeData.streams.find(
      (stream: any) => stream.codec_type === 'video',
    );
    const format = probeData.format;

    if (!videoStream) {
      throw new Error('No video stream found in file');
    }

    return {
      duration: Number.parseFloat(format.duration) || 0,
      width: Number.parseInt(videoStream.width) || 0,
      height: Number.parseInt(videoStream.height) || 0,
      frameRate: this.parseFrameRate(videoStream.r_frame_rate) || 0,
      codec: videoStream.codec_name || 'unknown',
      bitrate: Number.parseInt(format.bit_rate) || 0,
      format: format.format_name || 'unknown',
      size: Number.parseInt(format.size) || 0,
    };
  }

  private parseFrameRate(frameRateString: string): number {
    if (!frameRateString) return 0;

    const parts = frameRateString.split('/');
    if (parts.length === 2) {
      const numerator = Number.parseInt(parts[0]);
      const denominator = Number.parseInt(parts[1]);
      return denominator > 0 ? numerator / denominator : 0;
    }

    return Number.parseFloat(frameRateString) || 0;
  }
}
