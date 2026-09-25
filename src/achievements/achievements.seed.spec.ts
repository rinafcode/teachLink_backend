import { Logger } from '@nestjs/common';
import { DEFAULT_ACHIEVEMENTS, seedAchievements } from './achievements.seed';

describe('seedAchievements', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('seeds all default achievements and logs success via Logger', async () => {
    const achievementsService = {
      createAchievement: jest.fn().mockResolvedValue(undefined),
    };

    await seedAchievements(achievementsService);

    expect(achievementsService.createAchievement).toHaveBeenCalledTimes(
      DEFAULT_ACHIEVEMENTS.length,
    );
    for (const achievement of DEFAULT_ACHIEVEMENTS) {
      expect(achievementsService.createAchievement).toHaveBeenCalledWith(achievement);
    }
    expect(logSpy).toHaveBeenCalledWith(`Seeded ${DEFAULT_ACHIEVEMENTS.length} achievements`);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs via Logger.error and rethrows when seeding fails', async () => {
    const failure = new Error('Database connection failed');
    const achievementsService = {
      createAchievement: jest.fn().mockRejectedValue(failure),
    };

    await expect(seedAchievements(achievementsService)).rejects.toThrow(failure);

    expect(errorSpy).toHaveBeenCalledWith('Error seeding achievements', failure.stack);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs stringified non-Error rejections and rethrows', async () => {
    const achievementsService = {
      createAchievement: jest.fn().mockRejectedValue('unexpected failure'),
    };

    await expect(seedAchievements(achievementsService)).rejects.toBe('unexpected failure');

    expect(errorSpy).toHaveBeenCalledWith('Error seeding achievements', 'unexpected failure');
    expect(logSpy).not.toHaveBeenCalled();
  });
});
