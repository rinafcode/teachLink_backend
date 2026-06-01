import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationPreferences } from '../entities/notification-preferences.entity';
import { PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  let service: PreferencesService;
  const repository = {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((prefs) => Promise.resolve(prefs)),
  };

  beforeEach(async () => {
    repository.findOne.mockReset();
    repository.create.mockReset();
    repository.save.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreferencesService,
        {
          provide: getRepositoryToken(NotificationPreferences),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(PreferencesService);
  });

  it('should create default preferences when none exist', async () => {
    repository.findOne.mockResolvedValueOnce(undefined);
    const prefs = await service.getPreferences('user-1');
    expect(repository.create).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
    expect(prefs.userId).toBe('user-1');
  });

  it('should toggle channel preferences', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1', emailEnabled: true });
    repository.save.mockResolvedValueOnce({ userId: 'user-1', emailEnabled: false });

    const updated = await service.toggleChannel('user-1', 'emailEnabled');
    expect(updated.emailEnabled).toBe(false);
    expect(repository.save).toHaveBeenCalled();
  });
});
