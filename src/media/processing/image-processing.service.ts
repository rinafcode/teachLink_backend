import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { COMPRESSION_CONFIG, THUMBNAIL_CONFIG, IMAGE_DIMENSION_LIMITS, } from '../validation/file-validation.constants';
export interface ProcessedImage {
    buffer: Buffer;
    format: string;
    width: number;
    height: number;
    size: number;
    originalSize: number;
    compressionRatio: number;
}
export interface ThumbnailResult {
    name: string;
    buffer: Buffer;
    width: number;
    height: number;
    size: number;
    url?: string;
}
export interface ImageMetadata {
    width: number;
    height: number;
    format: string;
    hasAlpha: boolean;
    size: number;
    density?: number;
    space?: string;
    channels?: number;
}
@Injectable()
export class ImageProcessingService {
    private readonly logger = new Logger(ImageProcessingService.name);
    /**
     * Get image metadata
     */
    async getMetadata(buffer: Buffer): Promise<ImageMetadata> {
        const metadata = await sharp(buffer).metadata();
        const stats = await sharp(buffer).stats();
        return {
            width: metadata.width || 0,
            height: metadata.height || 0,
            format: metadata.format || 'unknown',
            hasAlpha: metadata.hasAlpha || false,
            size: buffer.length,
            density: metadata.density,
            space: metadata.space,
            channels: stats.channels.length,
        };
    }
    /**
     * Compress and optimize image
     */
    async compressImage(buffer: Buffer, options?: {
        maxWidth?: number;
        maxHeight?: number;
        quality?: number;
        format?: 'jpeg' | 'png' | 'webp' | 'avif';
        preserveAspectRatio?: boolean;
    }): Promise<ProcessedImage> {
        const originalSize = buffer.length;
        const metadata = await sharp(buffer).metadata();
        let pipeline = sharp(buffer);
        // Determine output format
        const outputFormat = options?.format || this.getOptimalFormat(metadata.format);
        // Resize if dimensions exceed limits
        const maxWidth = options?.maxWidth || COMPRESSION_CONFIG.MAX_DIMENSION;
        const maxHeight = options?.maxHeight || COMPRESSION_CONFIG.MAX_DIMENSION;
        if (metadata.width && metadata.height) {
            if (metadata.width > maxWidth || metadata.height > maxHeight) {
                pipeline = pipeline.resize(maxWidth, maxHeight, {
                    fit: 'inside',
                    withoutEnlargement: true,
                });
            }
        }
        // Apply format-specific compression
        const quality = options?.quality || this.getDefaultQuality(outputFormat);
        switch (outputFormat) {
            case 'jpeg':
            case 'jpg':
                pipeline = pipeline.jpeg({
                    quality,
                    progressive: true,
                    mozjpeg: true,
                });
                break;
            case 'png':
                pipeline = pipeline.png({
                    compressionLevel: COMPRESSION_CONFIG.PNG_COMPRESSION_LEVEL,
                    progressive: true,
                    adaptiveFiltering: true,
                });
                break;
            case 'webp':
                pipeline = pipeline.webp({
                    quality,
                    effort: 6,
                });
                break;
            case 'avif':
                pipeline = pipeline.avif({
                    quality,
                    effort: 4,
                });
                break;
            default:
                // Keep original format with default compression
                pipeline = pipeline.jpeg({ quality: COMPRESSION_CONFIG.JPEG_QUALITY });
        }
        // Process image
        const processedBuffer = await pipeline.toBuffer();
        const processedMetadata = await sharp(processedBuffer).metadata();
        const compressionRatio = originalSize > 0 ? ((originalSize - processedBuffer.length) / originalSize) * 100 : 0;
        this.logger.log(`Image compressed: ${originalSize} -> ${processedBuffer.length} bytes (${compressionRatio.toFixed(1)}% reduction)`);
        return {
            buffer: processedBuffer,
            format: outputFormat,
            width: processedMetadata.width || 0,
            height: processedMetadata.height || 0,
            size: processedBuffer.length,
            originalSize,
            compressionRatio,
        };
    }
    /**
     * Generate thumbnails in multiple sizes
     */
    async generateThumbnails(buffer: Buffer, options?: {
        sizes?: Array<{
            name: string;
            width: number;
            height: number;
        }>;
        format?: 'jpeg' | 'png' | 'webp';
        quality?: number;
    }): Promise<ThumbnailResult[]> {
        const sizes = options?.sizes || THUMBNAIL_CONFIG.SIZES;
        const format = options?.format || THUMBNAIL_CONFIG.DEFAULT_FORMAT;
        const quality = options?.quality || THUMBNAIL_CONFIG.DEFAULT_QUALITY;
        const thumbnails: ThumbnailResult[] = [];
        for (const size of sizes) {
            try {
                let pipeline = sharp(buffer);
                // Resize to thumbnail dimensions
                pipeline = pipeline.resize(size.width, size.height, {
                    fit: 'cover',
                    position: 'center',
                });
                // Apply format-specific settings
                switch (format) {
                    case 'jpeg':
                        pipeline = pipeline.jpeg({ quality, progressive: true });
                        break;
                    case 'png':
                        pipeline = pipeline.png({ compressionLevel: 9 });
                        break;
                    case 'webp':
                    default:
                        pipeline = pipeline.webp({ quality, effort: 6 });
                }
                const thumbnailBuffer = await pipeline.toBuffer();
                const metadata = await sharp(thumbnailBuffer).metadata();
                thumbnails.push({
                    name: size.name,
                    buffer: thumbnailBuffer,
                    width: metadata.width || size.width,
                    height: metadata.height || size.height,
                    size: thumbnailBuffer.length,
                });
                this.logger.log(`Generated ${size.name} thumbnail: ${thumbnailBuffer.length} bytes`);
            }
            catch (error) {
                this.logger.error(`Failed to generate ${size.name} thumbnail:`, error);
            }
        }
        return thumbnails;
    }
    /**
     * Generate a single thumbnail
     */
    async generateThumbnail(buffer: Buffer, width: number, height: number, options?: {
        format?: 'jpeg' | 'png' | 'webp';
        quality?: number;
        fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    }): Promise<Buffer> {
        const format = options?.format || THUMBNAIL_CONFIG.DEFAULT_FORMAT;
        const quality = options?.quality || THUMBNAIL_CONFIG.DEFAULT_QUALITY;
        const fit = options?.fit || 'cover';
        let pipeline = sharp(buffer).resize(width, height, {
            fit,
            position: 'center',
        });
        switch (format) {
            case 'jpeg':
                pipeline = pipeline.jpeg({ quality, progressive: true });
                break;
            case 'png':
                pipeline = pipeline.png({ compressionLevel: 9 });
                break;
            case 'webp':
            default:
                pipeline = pipeline.webp({ quality, effort: 6 });
        }
        return pipeline.toBuffer();
    }
    /**
     * Validate image dimensions
     */
    async validateDimensions(buffer: Buffer): Promise<{
        valid: boolean;
        width?: number;
        height?: number;
        errors: string[];
    }> {
        const metadata = await sharp(buffer).metadata();
        const errors: string[] = [];
        if (!metadata.width || !metadata.height) {
            return {
                valid: false,
                errors: ['Could not determine image dimensions'],
            };
        }
        const { MIN_WIDTH, MIN_HEIGHT, MAX_WIDTH, MAX_HEIGHT, MAX_PIXELS } = IMAGE_DIMENSION_LIMITS;
        if (metadata.width < MIN_WIDTH || metadata.height < MIN_HEIGHT) {
            errors.push(`Image dimensions too small (minimum: ${MIN_WIDTH}x${MIN_HEIGHT})`);
        }
        if (metadata.width > MAX_WIDTH || metadata.height > MAX_HEIGHT) {
            errors.push(`Image dimensions too large (maximum: ${MAX_WIDTH}x${MAX_HEIGHT})`);
        }
        const totalPixels = metadata.width * metadata.height;
        if (totalPixels > MAX_PIXELS) {
            errors.push(`Image has too many pixels (maximum: ${MAX_PIXELS.toLocaleString()})`);
        }
        return {
            valid: errors.length === 0,
            width: metadata.width,
            height: metadata.height,
            errors,
        };
    }
    /**
     * Convert image to different format
     */
    async convertFormat(buffer: Buffer, targetFormat: 'jpeg' | 'png' | 'webp' | 'avif', quality?: number): Promise<Buffer> {
        let pipeline = sharp(buffer);
        const q = quality || this.getDefaultQuality(targetFormat);
        switch (targetFormat) {
            case 'jpeg':
                pipeline = pipeline.jpeg({ quality: q, progressive: true });
                break;
            case 'png':
                pipeline = pipeline.png({ compressionLevel: COMPRESSION_CONFIG.PNG_COMPRESSION_LEVEL });
                break;
            case 'webp':
                pipeline = pipeline.webp({ quality: q, effort: 6 });
                break;
            case 'avif':
                pipeline = pipeline.avif({ quality: q, effort: 4 });
                break;
        }
        return pipeline.toBuffer();
    }
    /**
     * Strip metadata from image (privacy/security)
     */
    async stripMetadata(buffer: Buffer): Promise<Buffer> {
        return sharp(buffer).withMetadata().toBuffer();
    }
    /**
     * Get optimal format based on content type
     */
    private getOptimalFormat(currentFormat?: string): string {
        switch (currentFormat) {
            case 'png':
                return 'png'; // Keep PNG for transparency
            case 'gif':
                return 'webp'; // Convert GIF to WebP
            case 'svg':
                return 'png'; // Rasterize SVG
            case 'webp':
                return 'webp';
            case 'avif':
                return 'avif';
            case 'jpeg':
            case 'jpg':
            default:
                return 'webp'; // Default to WebP for best compression
        }
    }
    /**
     * Get default quality for format
     */
    private getDefaultQuality(format: string): number {
        switch (format) {
            case 'jpeg':
            case 'jpg':
                return COMPRESSION_CONFIG.JPEG_QUALITY;
            case 'webp':
                return COMPRESSION_CONFIG.WEBP_QUALITY;
            case 'avif':
                return COMPRESSION_CONFIG.AVIF_QUALITY;
            case 'png':
                return 100; // PNG uses compression level, not quality
            default:
                return 85;
        }
    }
}
