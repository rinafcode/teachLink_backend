import { Processor, Process, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue.constants';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import { FileStorageService } from '../storage/file-storage.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UploadedFile } from '@nestjs/common';
import { ContentMetadata } from '../../cdn/entities/content-metadata.entity';
@Processor(QUEUE_NAMES.MEDIA_PROCESSING)
export class VideoProcessor {
    private readonly logger = new Logger(VideoProcessor.name);
    constructor(private readonly storage: FileStorageService, 
    @InjectRepository(ContentMetadata)
    private readonly contentRepo: Repository<ContentMetadata>,
  ) {}

  @Process(JOB_NAMES.TRANSCODE_VIDEO)
  async handleTranscode(job: Job) {
    const { contentId, url, fileName } = job.data as {
      contentId: string;
      url: string;
      fileName: string;
    };
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
        .outputOptions(['-map 0:v', '-map 0:a?', '-c:a aac', '-c:v h264', '-profile:v main'])
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
      const fakeFile: UploadedFile = {
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
      // Extend metadata type to include hlsManifest for videos
      (meta.metadata as any).hlsManifest =
        uploaded.find((u) => u.endsWith('index.m3u8')) || uploaded[0];
      meta.variants = uploaded.map((u) => ({
        name: u.split('/').pop(),
        url: u,
        width: 0,
        height: 0,
        size: 0,
      }));
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

  /**
   * Executes on Failed.
   * @param job The job.
   * @param err The err.
   * @returns The operation result.
   */
  @OnQueueFailed()
  async onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} failed: ${err.message}`);
  }

  /**
   * Executes on Complete.
   * @param job The job.
   * @param _result The result.
   * @returns The operation result.
   */
  @OnQueueCompleted()
  async onComplete(job: Job, _result: any) {
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
      file.on('finish', () => {
        file.close((err?: NodeJS.ErrnoException | null) => {
          if (err) reject(err);
          else resolve();
        });
        // Upload HLS directory contents
        const files = fs.readdirSync(hlsDir);
        const uploaded: string[] = [];
        for (const f of files) {
            const p = path.join(hlsDir, f);
            const buffer = fs.readFileSync(p);
            // store each file under contentId/hls/
            const fakeFile: UploadedFile = {
                buffer,
                originalname: f,
                mimetype: 'application/octet-stream',
                size: buffer.length,
                fieldname: 'file',
                encoding: '7bit',
                destination: '',
                filename: f,
                stream: null as unknown,
                path: p,
            };
            const keyRes = await this.storage.uploadFile(fakeFile as unknown, { contentId } as unknown);
            uploaded.push(keyRes.url);
        }
        // Update metadata
        const meta = await this.contentRepo.findOne({ where: { contentId } });
        if (meta) {
            meta.metadata = meta.metadata || {};
            // Extend metadata type to include hlsManifest for videos
            (meta.metadata as unknown).hlsManifest =
                uploaded.find((u) => u.endsWith('index.m3u8')) || uploaded[0];
            meta.variants = uploaded.map((u) => ({
                name: u.split('/').pop(),
                url: u,
                width: 0,
                height: 0,
                size: 0,
            }));
            meta.status = 'ready' as unknown;
            await this.contentRepo.save(meta);
        }
        // Cleanup
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
        catch (e) {
            this.logger.warn('Failed to clean tmpdir', e);
        }
        return { uploaded };
    }
    @OnQueueFailed()
    async onFailed(job: Job, err: Error) {
        this.logger.error(`Job ${job.id} failed: ${err.message}`);
    }
    @OnQueueCompleted()
    async onComplete(job: Job, _result: unknown) {
        this.logger.log(`Job ${job.id} completed`);
    }
}
async function downloadToFile(url: string, dest: string): Promise<void> {
    const https = url.startsWith('https') ? await import('https') : await import('http');
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const req = https.get(url, (res: unknown) => {
            if (res.statusCode >= 400)
                return reject(new Error(`Failed to download: ${res.statusCode}`));
            res.pipe(file);
            file.on('finish', () => {
                file.close((err?: NodeJS.ErrnoException | null) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        });
        req.on('error', (err: Error) => reject(err));
    });
}
