import { Test, TestingModule } from '@nestjs/testing';
import { SessionCleanupTask } from './session-cleanup.task';
import { SessionService } from '../session.service';
import { SESSION_REDIS_CLIENT } from '../session.constants';

const mockSessionService = {
  getUserSessionIds: jest.fn(),
  getSession: jest.fn(),
  removeSessionFromUserIndex: jest.fn(),
};

const mockRedis = {
  scan: jest.fn(),
};

describe('SessionCleanupTask', () => {
  let task: SessionCleanupTask;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionCleanupTask,
        { provide: SessionService, useValue: mockSessionService },
        { provide: SESSION_REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    task = module.get(SessionCleanupTask);
  });

  afterEach(() => jest.clearAllMocks());

  it('does nothing when no user session keys exist', async () => {
    mockRedis.scan.mockResolvedValueOnce(['0', []]);

    await task.handleCleanup();

    expect(mockSessionService.getUserSessionIds).not.toHaveBeenCalled();
    expect(mockSessionService.removeSessionFromUserIndex).not.toHaveBeenCalled();
  });

  it('removes stale session ids from the index', async () => {
    mockRedis.scan.mockResolvedValueOnce(['0', ['user:sessions:user-1']]);
    mockSessionService.getUserSessionIds.mockResolvedValueOnce(['sid-expired', 'sid-live']);
    mockSessionService.getSession
      .mockResolvedValueOnce(null) // sid-expired → gone
      .mockResolvedValueOnce({ sid: 'sid-live', userId: 'user-1' }); // sid-live → still there

    await task.handleCleanup();

    expect(mockSessionService.removeSessionFromUserIndex).toHaveBeenCalledTimes(1);
    expect(mockSessionService.removeSessionFromUserIndex).toHaveBeenCalledWith(
      'user-1',
      'sid-expired',
    );
  });

  it('keeps live session ids in the index', async () => {
    mockRedis.scan.mockResolvedValueOnce(['0', ['user:sessions:user-2']]);
    mockSessionService.getUserSessionIds.mockResolvedValueOnce(['sid-active']);
    mockSessionService.getSession.mockResolvedValueOnce({ sid: 'sid-active', userId: 'user-2' });

    await task.handleCleanup();

    expect(mockSessionService.removeSessionFromUserIndex).not.toHaveBeenCalled();
  });

  it('handles multiple cursor pages', async () => {
    mockRedis.scan
      .mockResolvedValueOnce(['42', ['user:sessions:user-3']])
      .mockResolvedValueOnce(['0', ['user:sessions:user-4']]);
    mockSessionService.getUserSessionIds.mockResolvedValue([]);

    await task.handleCleanup();

    expect(mockRedis.scan).toHaveBeenCalledTimes(2);
  });

  it('does not throw when cleanup encounters an error', async () => {
    mockRedis.scan.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(task.handleCleanup()).resolves.not.toThrow();
  });
});
