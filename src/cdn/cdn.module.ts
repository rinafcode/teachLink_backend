import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CdnService } from './cdn.service';
import { CdnController } from './cdn.controller';
import { AssetOptimizationService } from './optimization/asset-optimization.service';
import { EdgeCachingService } from './caching/edge-caching.service';
import { GeoLocationService } from './geo/geo-location.service';
import { CloudflareService } from './providers/cloudflare.service';
import { AWSCloudFrontService } from './providers/aws-cloudfront.service';
import { ContentMetadata } from './entities/content-metadata.entity';
import { FileValidationService } from '../media/validation/file-validation.service';
import { MalwareScanningService } from '../media/validation/malware-scanning.service';
import { ImageProcessingService } from '../media/processing/image-processing.service';

@Module({
  imports: [
    ConfigModule,
    CacheModule.register(),
    TypeOrmModule.forFeature([ContentMetadata]),
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB limit (largest for videos)
      },
    }),
  ],
  controllers: [CdnController],
  providers: [
    CdnService,
    AssetOptimizationService,
    EdgeCachingService,
    GeoLocationService,
    CloudflareService,
    AWSCloudFrontService,
    FileValidationService,
    MalwareScanningService,
    ImageProcessingService,
  ],
  exports: [
    CdnService,
    AssetOptimizationService,
    EdgeCachingService,
    GeoLocationService,
    CloudflareService,
    AWSCloudFrontService,
    FileValidationService,
    ImageProcessingService,
  ],
})
export class CdnModule {}
