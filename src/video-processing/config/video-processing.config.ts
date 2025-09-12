import { registerAs } from '@nestjs/config';

export default registerAs('videoProcessing', () => ({
  // Storage configuration
  storage: {
    path: process.env.STORAGE_PATH || './storage',
    maxFileSize: Number.parseInt(process.env.MAX_FILE_SIZE || '5368709120'), // 5GB
    allowedMimeTypes: (
      process.env.ALLOWED_MIME_TYPES ||
      'video/mp4,video/webm,video/avi,video/mov,video/mkv'
    ).split(','),
  },

  // FFmpeg configuration
  ffmpeg: {
    path: process.env.FFMPEG_PATH || 'ffmpeg',
    ffprobePath: process.env.FFPROBE_PATH || 'ffprobe',
    timeout: Number.parseInt(process.env.FFMPEG_TIMEOUT || '3600000'), // 1 hour
    maxConcurrentJobs: Number.parseInt(
      process.env.MAX_CONCURRENT_FFMPEG_JOBS || '4',
    ),
  },

  // Processing configuration
  processing: {
    defaultQualities: (process.env.DEFAULT_QUALITIES || '720p,480p,360p').split(
      ',',
    ),
    defaultFormats: (process.env.DEFAULT_FORMATS || 'mp4,webm').split(','),
    enableThumbnails: process.env.ENABLE_THUMBNAILS !== 'false',
    enablePreviews: process.env.ENABLE_PREVIEWS !== 'false',
    enableAdaptiveStreaming: process.env.ENABLE_ADAPTIVE_STREAMING !== 'false',
    thumbnailCount: Number.parseInt(process.env.THUMBNAIL_COUNT || '5'),
    previewDuration: Number.parseInt(process.env.PREVIEW_DURATION || '30'),
  },

  // Queue configuration
  queue: {
    maxRetries: Number.parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
    retryDelay: Number.parseInt(process.env.QUEUE_RETRY_DELAY || '30000'), // 30 seconds
    jobTimeout: Number.parseInt(process.env.JOB_TIMEOUT || '1800000'), // 30 minutes
    cleanupInterval: Number.parseInt(process.env.CLEANUP_INTERVAL || '3600000'), // 1 hour
    maxConcurrentJobs: {
      high: Number.parseInt(process.env.HIGH_PRIORITY_MAX_JOBS || '2'),
      normal: Number.parseInt(process.env.NORMAL_PRIORITY_MAX_JOBS || '5'),
      low: Number.parseInt(process.env.LOW_PRIORITY_MAX_JOBS || '10'),
      thumbnail: Number.parseInt(process.env.THUMBNAIL_MAX_JOBS || '8'),
    },
  },

  // Monitoring configuration
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    metricsInterval: Number.parseInt(process.env.METRICS_INTERVAL || '60000'), // 1 minute
    healthCheckInterval: Number.parseInt(
      process.env.HEALTH_CHECK_INTERVAL || '30000',
    ), // 30 seconds
    retentionDays: Number.parseInt(process.env.METRICS_RETENTION_DAYS || '30'),
  },

  // Security configuration
  security: {
    enableAuth: process.env.ENABLE_AUTH === 'true',
    apiKeyHeader: process.env.API_KEY_HEADER || 'x-api-key',
    rateLimitWindow: Number.parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
    rateLimitMax: Number.parseInt(process.env.RATE_LIMIT_MAX || '100'),
  },
}));
