import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { CDNService } from './services/cdn.service';
import { AssetOptimizationService } from './services/asset-optimization.service';
import { EdgeCachingService } from './services/edge-caching.service';
import { GeoLocationService } from './services/geo-location.service';
import { Asset, AssetType, OptimizationStatus } from './entities/asset.entity';
import {
  CDNProvider,
  ProviderType,
  ProviderStatus,
} from './entities/cdn-provider.entity';
import { jest } from '@jest/globals'; // Import jest to fix the undeclared variable error

describe('CDNService', () => {
  let service: CDNService;
  let assetRepository: Repository<Asset>;
  let providerRepository: Repository<CDNProvider>;
  let assetOptimizationService: AssetOptimizationService;
  let edgeCachingService: EdgeCachingService;
  let geoLocationService: GeoLocationService;

  const mockAssetRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockProviderRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAssetOptimizationService = {
    optimizeImage: jest.fn(),
  };

  const mockEdgeCachingService = {
    cacheAsset: jest.fn(),
    getCachedUrl: jest.fn(),
    purgeAsset: jest.fn(),
  };

  const mockGeoLocationService = {
    getLocationByIP: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CDNService,
        {
          provide: getRepositoryToken(Asset),
          useValue: mockAssetRepository,
        },
        {
          provide: getRepositoryToken(CDNProvider),
          useValue: mockProviderRepository,
        },
        {
          provide: AssetOptimizationService,
          useValue: mockAssetOptimizationService,
        },
        {
          provide: EdgeCachingService,
          useValue: mockEdgeCachingService,
        },
        {
          provide: GeoLocationService,
          useValue: mockGeoLocationService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CDNService>(CDNService);
    assetRepository = module.get<Repository<Asset>>(getRepositoryToken(Asset));
    providerRepository = module.get<Repository<CDNProvider>>(
      getRepositoryToken(CDNProvider),
    );
    assetOptimizationService = module.get<AssetOptimizationService>(
      AssetOptimizationService,
    );
    edgeCachingService = module.get<EdgeCachingService>(EdgeCachingService);
    geoLocationService = module.get<GeoLocationService>(GeoLocationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadAsset', () => {
    it('should upload and optimize an image asset', async () => {
      const mockFile = Buffer.from('test image data');
      const mockAsset = {
        id: 'test-id',
        originalUrl: 'test.jpg',
        type: AssetType.IMAGE,
        originalSize: mockFile.length,
        contentHash: 'test-hash',
        status: OptimizationStatus.PENDING,
        cdnUrls: [],
      };

      const mockOptimizedBuffer = Buffer.from('optimized image data');
      const mockCdnUrls = ['https://cdn.example.com/test.jpg'];

      mockAssetRepository.findOne.mockResolvedValue(null);
      mockAssetRepository.create.mockReturnValue(mockAsset);
      mockAssetRepository.save.mockResolvedValue(mockAsset);
      mockAssetOptimizationService.optimizeImage.mockResolvedValue(
        mockOptimizedBuffer,
      );
      mockProviderRepository.find.mockResolvedValue([
        {
          id: 'provider-1',
          type: ProviderType.CLOUDFLARE,
          status: ProviderStatus.ACTIVE,
          priority: 1,
        },
      ]);
      mockEdgeCachingService.cacheAsset.mockResolvedValue(undefined);

      // Mock the private uploadToProviders method
      jest
        .spyOn(service as any, 'uploadToProviders')
        .mockResolvedValue(mockCdnUrls);

      const result = await service.uploadAsset(
        mockFile,
        'test.jpg',
        AssetType.IMAGE,
        { quality: 80, format: 'webp' },
      );

      expect(result).toEqual({
        url: mockCdnUrls[0],
        provider: 'primary',
        region: 'global',
        cached: true,
        optimized: true,
        size: mockOptimizedBuffer.length,
        metadata: mockAsset.metadata,
      });

      expect(mockAssetOptimizationService.optimizeImage).toHaveBeenCalledWith(
        mockFile,
        { quality: 80, format: 'webp' },
      );
      expect(mockEdgeCachingService.cacheAsset).toHaveBeenCalledWith(
        mockAsset.id,
        mockCdnUrls[0],
      );
    });

    it('should handle existing asset with same content hash', async () => {
      const mockFile = Buffer.from('test image data');
      const existingAsset = {
        id: 'existing-id',
        originalUrl: 'existing.jpg',
        type: AssetType.IMAGE,
        originalSize: mockFile.length,
        contentHash: 'test-hash',
        status: OptimizationStatus.COMPLETED,
        cdnUrls: ['https://cdn.example.com/existing.jpg'],
      };

      mockAssetRepository.findOne.mockResolvedValue(existingAsset);
      mockAssetRepository.save.mockResolvedValue(existingAsset);
      mockAssetOptimizationService.optimizeImage.mockResolvedValue(mockFile);
      mockEdgeCachingService.cacheAsset.mockResolvedValue(undefined);

      jest
        .spyOn(service as any, 'uploadToProviders')
        .mockResolvedValue(existingAsset.cdnUrls);

      const result = await service.uploadAsset(
        mockFile,
        'test.jpg',
        AssetType.IMAGE,
      );

      expect(result.url).toBe(existingAsset.cdnUrls[0]);
      expect(mockAssetRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getOptimizedUrl', () => {
    it('should return optimized URL with geo-location optimization', async () => {
      const mockAsset = {
        id: 'test-id',
        cdnUrls: ['https://cdn.example.com/test.jpg'],
        type: AssetType.IMAGE,
        status: OptimizationStatus.COMPLETED,
        optimizedSize: 1000,
        metadata: {},
      };

      const mockGeoData = {
        country: 'United States',
        region: 'us-east-1',
        city: 'New York',
        latitude: 40.7128,
        longitude: -74.006,
        timezone: 'America/New_York',
      };

      const mockProvider = {
        type: ProviderType.CLOUDFLARE,
        name: 'Cloudflare',
      };

      mockAssetRepository.findOne.mockResolvedValue(mockAsset);
      mockGeoLocationService.getLocationByIP.mockResolvedValue(mockGeoData);
      mockEdgeCachingService.getCachedUrl.mockResolvedValue(
        'https://cache.example.com/test.jpg',
      );

      jest
        .spyOn(service as any, 'getOptimalProvider')
        .mockResolvedValue(mockProvider);
      jest
        .spyOn(service as any, 'applyBandwidthOptimization')
        .mockResolvedValue(
          'https://cache.example.com/test.jpg?quality=85&format=webp',
        );

      const result = await service.getOptimizedUrl(
        'test-id',
        '192.168.1.1',
        '4g',
      );

      expect(result).toEqual({
        url: 'https://cache.example.com/test.jpg?quality=85&format=webp',
        provider: 'Cloudflare',
        region: 'us-east-1',
        cached: true,
        optimized: true,
        size: 1000,
        metadata: {},
      });

      expect(mockGeoLocationService.getLocationByIP).toHaveBeenCalledWith(
        '192.168.1.1',
      );
      expect(mockEdgeCachingService.getCachedUrl).toHaveBeenCalledWith(
        'test-id',
        'us-east-1',
        ProviderType.CLOUDFLARE,
      );
    });

    it('should throw error for non-existent asset', async () => {
      mockAssetRepository.findOne.mockResolvedValue(null);

      await expect(service.getOptimizedUrl('non-existent-id')).rejects.toThrow(
        'Asset not found',
      );
    });
  });

  describe('purgeCache', () => {
    it('should purge cache for specific regions', async () => {
      const mockAsset = {
        id: 'test-id',
        cdnUrls: ['https://cdn.example.com/test.jpg'],
      };

      const mockProviders = [
        {
          type: ProviderType.CLOUDFLARE,
          name: 'Cloudflare',
        },
      ];

      mockAssetRepository.findOne.mockResolvedValue(mockAsset);
      mockProviderRepository.find.mockResolvedValue(mockProviders);
      mockEdgeCachingService.purgeAsset.mockResolvedValue(undefined);

      jest
        .spyOn(service as any, 'purgeFromProvider')
        .mockResolvedValue(undefined);

      await service.purgeCache('test-id', ['us-east-1', 'eu-west-1']);

      expect(mockEdgeCachingService.purgeAsset).toHaveBeenCalledWith(
        'test-id',
        ['us-east-1', 'eu-west-1'],
      );
    });
  });
});

describe('AssetOptimizationService', () => {
  let service: AssetOptimizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssetOptimizationService],
    }).compile();

    service = module.get<AssetOptimizationService>(AssetOptimizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOptimalFormat', () => {
    it('should return webp for Chrome', () => {
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      const format = service.getOptimalFormat(userAgent);
      expect(format).toBe('webp');
    });

    it('should return jpeg for Safari', () => {
      const userAgent =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
      const format = service.getOptimalFormat(userAgent);
      expect(format).toBe('jpeg');
    });

    it('should return jpeg as fallback', () => {
      const userAgent = 'Unknown Browser';
      const format = service.getOptimalFormat(userAgent);
      expect(format).toBe('jpeg');
    });
  });

  describe('calculateOptimizationSavings', () => {
    it('should calculate savings correctly', () => {
      const result = service.calculateOptimizationSavings(1000, 600);
      expect(result).toEqual({
        savedBytes: 400,
        savedPercentage: 40,
      });
    });
  });
});

describe('EdgeCachingService', () => {
  let service: EdgeCachingService;
  let cacheRepository: Repository<any>;

  const mockCacheRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    increment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EdgeCachingService,
        {
          provide: getRepositoryToken('CacheEntry'),
          useValue: mockCacheRepository,
        },
      ],
    }).compile();

    service = module.get<EdgeCachingService>(EdgeCachingService);
    cacheRepository = module.get('CacheEntryRepository');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cacheAsset', () => {
    it('should create new cache entry', async () => {
      const mockCacheEntry = {
        key: 'test-id:global:primary',
        url: 'https://cdn.example.com/test.jpg',
        region: 'global',
        provider: 'primary',
        status: 'active',
      };

      mockCacheRepository.findOne.mockResolvedValue(null);
      mockCacheRepository.create.mockReturnValue(mockCacheEntry);
      mockCacheRepository.save.mockResolvedValue(mockCacheEntry);

      await service.cacheAsset('test-id', 'https://cdn.example.com/test.jpg');

      expect(mockCacheRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'test-id:global:primary',
          url: 'https://cdn.example.com/test.jpg',
          region: 'global',
          provider: 'primary',
        }),
      );
      expect(mockCacheRepository.save).toHaveBeenCalled();
    });

    it('should update existing cache entry', async () => {
      const existingEntry = {
        id: 'existing-id',
        key: 'test-id:global:primary',
        url: 'https://old-cdn.example.com/test.jpg',
      };

      mockCacheRepository.findOne.mockResolvedValue(existingEntry);
      mockCacheRepository.save.mockResolvedValue(existingEntry);

      await service.cacheAsset(
        'test-id',
        'https://new-cdn.example.com/test.jpg',
      );

      expect(existingEntry.url).toBe('https://new-cdn.example.com/test.jpg');
      expect(mockCacheRepository.save).toHaveBeenCalledWith(existingEntry);
    });
  });

  describe('getCachedUrl', () => {
    it('should return cached URL if valid', async () => {
      const mockCacheEntry = {
        id: 'cache-id',
        url: 'https://cache.example.com/test.jpg',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      };

      mockCacheRepository.findOne.mockResolvedValue(mockCacheEntry);
      mockCacheRepository.increment.mockResolvedValue(undefined);

      const result = await service.getCachedUrl('test-id');

      expect(result).toBe('https://cache.example.com/test.jpg');
      expect(mockCacheRepository.increment).toHaveBeenCalledWith(
        { id: 'cache-id' },
        'hitCount',
        1,
      );
    });

    it('should return null for expired cache', async () => {
      const mockCacheEntry = {
        id: 'cache-id',
        url: 'https://cache.example.com/test.jpg',
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      };

      mockCacheRepository.findOne.mockResolvedValue(mockCacheEntry);
      mockCacheRepository.update.mockResolvedValue(undefined);

      const result = await service.getCachedUrl('test-id');

      expect(result).toBeNull();
      expect(mockCacheRepository.update).toHaveBeenCalledWith('cache-id', {
        status: 'expired',
      });
    });
  });
});

describe('GeoLocationService', () => {
  let service: GeoLocationService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoLocationService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GeoLocationService>(GeoLocationService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points correctly', () => {
      // Distance between New York and Los Angeles (approximately 3944 km)
      const distance = (service as any).calculateDistance(
        40.7128,
        -74.006, // New York
        34.0522,
        -118.2437, // Los Angeles
      );

      expect(distance).toBeCloseTo(3944, -2); // Within 100km accuracy
    });
  });

  describe('getNearestEdgeLocation', () => {
    it('should return nearest edge location', async () => {
      const userLocation = {
        country: 'United States',
        region: 'us-east-1',
        city: 'New York',
        latitude: 40.7128,
        longitude: -74.006,
        timezone: 'America/New_York',
      };

      const result = await service.getNearestEdgeLocation(userLocation);

      expect(result).toBe('us-east-1'); // Virginia should be closest to New York
    });
  });

  describe('detectConnectionSpeed', () => {
    it('should return high speed for developed countries', async () => {
      jest.spyOn(service, 'getLocationByIP').mockResolvedValue({
        country: 'United States',
        region: 'us-east-1',
        city: 'New York',
        latitude: 40.7128,
        longitude: -74.006,
        timezone: 'America/New_York',
      });

      const result = await service.detectConnectionSpeed('192.168.1.1');
      expect(result).toBe('4g');
    });

    it('should return medium speed for developing countries', async () => {
      jest.spyOn(service, 'getLocationByIP').mockResolvedValue({
        country: 'Brazil',
        region: 'sa-east-1',
        city: 'São Paulo',
        latitude: -23.5505,
        longitude: -46.6333,
        timezone: 'America/Sao_Paulo',
      });

      const result = await service.detectConnectionSpeed('192.168.1.1');
      expect(result).toBe('3g');
    });
  });
});
