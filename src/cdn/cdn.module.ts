import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CDNService } from './services/cdn.service';
import { AssetOptimizationService } from './services/asset-optimization.service';
import { EdgeCachingService } from './services/edge-caching.service';
import { GeoLocationService } from './services/geo-location.service';
import { CDNController } from './controllers/cdn.controller';
import { Asset } from './entities/asset.entity';
import { CacheEntry } from './entities/cache-entry.entity';
import { CDNProvider } from './entities/cdn-provider.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Asset, CacheEntry, CDNProvider]),
  ],
  controllers: [CDNController],
  providers: [
    CDNService,
    AssetOptimizationService,
    EdgeCachingService,
    GeoLocationService,
  ],
  exports: [
    CDNService,
    AssetOptimizationService,
    EdgeCachingService,
    GeoLocationService,
  ],
})
export class CDNModule {}
