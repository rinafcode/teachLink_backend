import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LocalizationService } from './localization.service';
import { LanguageDetectionService } from './language-detection.service';
import { Translation } from './entities/translation.entity';
import { bundleCacheKey } from './localization.constants';

describe('LocalizationService', () => {
  let service: LocalizationService;
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let translationRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    create: jest.Mock;
    upsert: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    translationRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      create: jest.fn((x) => ({ ...x, id: 'new-id' })),
      upsert: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalizationService,
        LanguageDetectionService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'I18N_DEFAULT_LOCALE') return 'en';
              if (key === 'I18N_SUPPORTED_LOCALES') return 'en,fr';
              if (key === 'I18N_CACHE_TTL_SECONDS') return '300';
              return undefined;
            },
          },
        },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: getRepositoryToken(Translation), useValue: translationRepo },
      ],
    }).compile();

    service = module.get(LocalizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('interpolate', () => {
    it('replaces {{name}} placeholders', () => {
      expect(service.interpolate('Hello {{name}}', { name: 'Ada' })).toBe('Hello Ada');
    });

    it('leaves unknown tokens', () => {
      expect(service.interpolate('{{a}}', {})).toBe('{{a}}');
    });
  });

  describe('translate', () => {
    beforeEach(() => {
      translationRepo.find.mockImplementation(
        (opts: { where: { namespace: string; locale: string } }) => {
          const { namespace, locale } = opts.where;
          if (namespace === 'app' && locale === 'fr') {
            return Promise.resolve([{ translationKey: 'b', value: 'deux' }]);
          }
          if (namespace === 'app' && locale === 'en') {
            return Promise.resolve([
              { translationKey: 'a', value: 'one' },
              { translationKey: 'b', value: 'two' },
              { translationKey: 'greet', value: 'Hi {{name}}' },
            ]);
          }
          return Promise.resolve([]);
        },
      );
    });

    it('interpolates variables', async () => {
      const t = await service.translate('app', 'greet', 'en', { name: 'Bo' });
      expect(t).toBe('Hi Bo');
    });

    it('falls back to default locale for missing key in requested locale', async () => {
      const t = await service.translate('app', 'a', 'fr');
      expect(t).toBe('one');
    });

    it('uses primary locale when key exists there', async () => {
      const t = await service.translate('app', 'b', 'fr');
      expect(t).toBe('deux');
    });

    it('returns namespace.key when missing everywhere', async () => {
      const t = await service.translate('app', 'missing', 'en');
      expect(t).toBe('app.missing');
    });
  });

  describe('invalidateBundles', () => {
    it('calls cache del for unique namespace/locale pairs', async () => {
      await service.invalidateBundles([
        { namespace: 'n', locale: 'en' },
        { namespace: 'n', locale: 'en' },
        { namespace: 'n', locale: 'fr' },
      ]);
      expect(cacheManager.del).toHaveBeenCalledWith(bundleCacheKey('n', 'en'));
      expect(cacheManager.del).toHaveBeenCalledWith(bundleCacheKey('n', 'fr'));
      expect(cacheManager.del).toHaveBeenCalledTimes(2);
    });
  });

  describe('create', () => {
    it('invalidates bundle cache after save', async () => {
      const saved = {
        id: '1',
        namespace: 'errors',
        translationKey: 'x',
        locale: 'en',
        value: 'v',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      translationRepo.save.mockResolvedValue(saved);
      await service.create({
        namespace: 'errors',
        key: 'x',
        locale: 'en',
        value: 'v',
      });
      expect(cacheManager.del).toHaveBeenCalledWith(bundleCacheKey('errors', 'en'));
    });
  });

  describe('toCsv', () => {
    it('escapes commas and quotes', () => {
      const csv = LocalizationService.toCsv([
        { namespace: 'n', key: 'k', locale: 'en', value: 'say "hi", ok' },
      ]);
      expect(csv).toContain('"say ""hi"", ok"');
    });
  });
});
