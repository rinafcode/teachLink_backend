import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { CdnService } from './cdn.service';
import { CdnController } from './cdn.controller';
import { AssetOptimizationService } from './optimization/asset-optimization.service';
import { EdgeCachingService } from './caching/edge-caching.service';
import { GeoLocationService } from './geo/geo-location.service';
import { CloudflareService } from './providers/cloudflare.service';
import { AWSCloudFrontService } from './providers/aws-cloudfront.service';
import { ContentMetadata } from './entities/content-metadata.entity';

@Module({
  imports: [
    ConfigModule,
    CacheModule.register(),
    TypeOrmModule.forFeature([ContentMetadata]),
    MulterModule.register({
      dest: './uploads',
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
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
  ],
  exports: [
    CdnService,
    AssetOptimizationService,
    EdgeCachingService,
    GeoLocationService,
    CloudflareService,
    AWSCloudFrontService,
  ],
})
export class CdnModule {}
