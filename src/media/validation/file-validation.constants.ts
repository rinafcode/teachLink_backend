export const ALLOWED_FILE_TYPES = {
  // Images
  IMAGES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
    'image/avif',
  ],

  // Videos
  VIDEOS: [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/mpeg',
  ],

  // Documents
  DOCUMENTS: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/rtf',
  ],

  // Audio
  AUDIO: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/aac',
    'audio/webm',
    'audio/flac',
  ],

  // Archives (limited)
  ARCHIVES: ['application/zip', 'application/x-zip-compressed'],
} as const;

export const ALLOWED_EXTENSIONS = {
  IMAGES: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.avif'],
  VIDEOS: ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.mpeg'],
  DOCUMENTS: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf'],
  AUDIO: ['.mp3', '.wav', '.ogg', '.aac', '.webm', '.flac'],
  ARCHIVES: ['.zip'],
} as const;

export const FILE_SIZE_LIMITS = {
  // Images: 20MB
  IMAGE_MAX_SIZE: 20 * 1024 * 1024,

  // Videos: 500MB
  VIDEO_MAX_SIZE: 500 * 1024 * 1024,

  // Documents: 50MB
  DOCUMENT_MAX_SIZE: 50 * 1024 * 1024,

  // Audio: 100MB
  AUDIO_MAX_SIZE: 100 * 1024 * 1024,

  // Archives: 100MB
  ARCHIVE_MAX_SIZE: 100 * 1024 * 1024,

  // Default: 10MB
  DEFAULT_MAX_SIZE: 10 * 1024 * 1024,
} as const;

export const ALL_ALLOWED_FILE_TYPES = Object.values(ALLOWED_FILE_TYPES).flat();
export const MAX_UPLOAD_FILE_SIZE = Math.max(
  FILE_SIZE_LIMITS.IMAGE_MAX_SIZE,
  FILE_SIZE_LIMITS.VIDEO_MAX_SIZE,
  FILE_SIZE_LIMITS.DOCUMENT_MAX_SIZE,
  FILE_SIZE_LIMITS.AUDIO_MAX_SIZE,
  FILE_SIZE_LIMITS.ARCHIVE_MAX_SIZE,
);

export const IMAGE_DIMENSION_LIMITS = {
  MIN_WIDTH: 1,
  MIN_HEIGHT: 1,
  MAX_WIDTH: 16384,
  MAX_HEIGHT: 16384,
  MAX_PIXELS: 100_000_000, // 100 megapixels
} as const;

export const THUMBNAIL_CONFIG = {
  SIZES: [
    { name: 'thumbnail', width: 150, height: 150 },
    { name: 'small', width: 300, height: 300 },
    { name: 'medium', width: 600, height: 600 },
    { name: 'large', width: 1200, height: 1200 },
  ],
  DEFAULT_FORMAT: 'webp' as const,
  DEFAULT_QUALITY: 80,
} as const;

export const COMPRESSION_CONFIG = {
  JPEG_QUALITY: 85,
  PNG_COMPRESSION_LEVEL: 9,
  WEBP_QUALITY: 85,
  AVIF_QUALITY: 80,
  MAX_DIMENSION: 4096,
} as const;

export const MALWARE_SCAN_CONFIG = {
  MAX_FILE_SIZE_FOR_SCAN: 100 * 1024 * 1024, // 100MB
  TIMEOUT_MS: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
} as const;

export const UPLOAD_PROGRESS_CONFIG = {
  REDIS_KEY_PREFIX: 'upload:progress:',
  EXPIRY_SECONDS: 3600, // 1 hour
  UPDATE_INTERVAL_MS: 500, // Update every 500ms
} as const;

export const MAGIC_NUMBERS: Record<string, Buffer[]> = {
  // Images
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  'image/gif': [
    Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]),
    Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  ],
  'image/webp': [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF header
  'image/bmp': [Buffer.from([0x42, 0x4d])], // BM
  'image/tiff': [Buffer.from([0x49, 0x49, 0x2a, 0x00]), Buffer.from([0x4d, 0x4d, 0x00, 0x2a])],

  // PDF
  'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF

  // ZIP (also for docx, xlsx, pptx)
  'application/zip': [Buffer.from([0x50, 0x4b, 0x03, 0x04])],

  // MP4
  'video/mp4': [
    Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),
    Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]),
  ],

  // MP3
  'audio/mpeg': [
    Buffer.from([0xff, 0xfb]),
    Buffer.from([0xff, 0xf3]),
    Buffer.from([0xff, 0xf2]),
    Buffer.from([0x49, 0x44, 0x33]),
  ],

  // WAV
  'audio/wav': [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF
} as const;
