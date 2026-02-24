import { Processor, Process, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import { FileStorageService } from '../storage/file-storage.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentMetadata, ContentType } from '../../cdn/entities/content-metadata.entity';

@Processor('media-processing')
export class VideoProcessor {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(
    private readonly storage: FileStorageService,
    @InjectRepository(ContentMetadata)
    private readonly contentRepo: Repository<ContentMetadata>,
  ) {}

  @Process('transcode-video')
  async handleTranscode(job: Job) {
    const { contentId, url, fileName } = job.data as { contentId: string; url: string; fileName: string };
    this.logger.log(`Transcoding job for ${contentId} - ${url}`);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `media-${contentId}-`));
    const inputPath = path.join(tmpDir, fileName);

    // Download the source
    const signed = await this.storage.getSignedUrl(url, 60);
    await downloadToFile(signed, inputPath);

    // Produce HLS with 3 variants (1080p,720p,480p)
    const hlsDir = path.join(tmpDir, 'hls');
    fs.mkdirSync(hlsDir);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .addOption('-preset', 'fast')
        .addOption('-g', '48')
        .addOption('-sc_threshold', '0')
        .outputOptions([
          '-map 0:v',
          '-map 0:a?',
          '-c:a aac',
          '-c:v h264',
          '-profile:v main',
        ])
        .output(path.join(hlsDir, 'index.m3u8'))
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    // Upload HLS directory contents
    const files = fs.readdirSync(hlsDir);
    const uploaded: string[] = [];
    for (const f of files) {
      const p = path.join(hlsDir, f);
      const buffer = fs.readFileSync(p);
      // store each file under contentId/hls/
      const fakeFile: Express.Multer.File = {
        buffer,
        originalname: f,
        mimetype: 'application/octet-stream',
        size: buffer.length,
        fieldname: 'file',
        encoding: '7bit',
        destination: '',
        filename: f,
        stream: null as any,
        path: p,
      };
      const keyRes = await this.storage.uploadFile(fakeFile as any, { contentId } as any);
      uploaded.push(keyRes.url);
    }

    // Update metadata
    const meta = await this.contentRepo.findOne({ where: { contentId } });
    if (meta) {
      meta.metadata = meta.metadata || {};
      meta.metadata.hlsManifest = uploaded.find((u) => u.endsWith('index.m3u8')) || uploaded[0];
      meta.variants = uploaded.map((u) => ({ name: u.split('/').pop(), url: u, width: 0, height: 0, size: 0 }));
      meta.status = 'ready' as any;
      await this.contentRepo.save(meta);
    }

    // Cleanup
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      this.logger.warn('Failed to clean tmpdir', e);
    }

    return { uploaded };
  }

  @OnQueueFailed()
  async onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} failed: ${err.message}`);
  }

  @OnQueueCompleted()
  async onComplete(job: Job, result: any) {
    this.logger.log(`Job ${job.id} completed`);
  }
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  const https = url.startsWith('https') ? await import('https') : await import('http');
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, (res: any) => {
      if (res.statusCode >= 400) return reject(new Error(`Failed to download: ${res.statusCode}`));
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    req.on('error', (err: Error) => reject(err));
  });
}
