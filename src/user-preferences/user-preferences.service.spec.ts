import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserPreference } from './entities/user-preference.entity';
import { UserPreferencesService } from './user-preferences.service';

describe('UserPreferencesService - currency (#1206)', () => {
  let service: UserPreferencesService;
  const repository = {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((prefs) => Promise.resolve(prefs)),
    remove: jest.fn((prefs) => Promise.resolve(prefs)),
  };

  beforeEach(async () => {
    repository.findOne.mockReset();
    repository.create.mockReset();
    repository.save.mockReset();
    repository.remove.mockReset();
    repository.create.mockImplementation((dto: any) => dto);
    repository.save.mockImplementation((prefs: any) => Promise.resolve(prefs));
    repository.remove.mockImplementation((prefs: any) => Promise.resolve(prefs));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserPreferencesService,
        {
          provide: getRepositoryToken(UserPreference),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(UserPreferencesService);
  });

  it('returns the currency column when reading an existing preference row', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1', currency: 'NGN' });

    const prefs = await service.getPreferences('user-1');

    expect(prefs.currency).toBe('NGN');
  });

  it('persists an updated currency value', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1', currency: 'USD' });

    const updated = await service.updatePreferences('user-1', { currency: 'EUR' } as any);

    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ currency: 'EUR' }));
    expect(updated.currency).toBe('EUR');
  });

  it('recreates default preferences with currency undefined so the entity default of USD applies', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1', currency: 'GBP' });

    await service.resetPreferences('user-1');

    expect(repository.remove).toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith({ userId: 'user-1' });
  });
});
