import { DataSource, QueryRunner, EntityManager } from 'typeorm';
import { TransactionHelperService } from './transaction-helper.service';

describe('TransactionHelperService', () => {
  let service: TransactionHelperService;
  let dataSource: { createQueryRunner: jest.Mock };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: EntityManager;
  };

  beforeEach(() => {
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {} as EntityManager,
    };
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };
    service = new TransactionHelperService(dataSource as unknown as DataSource);
  });

  afterEach(() => jest.restoreAllMocks());

  // ─── executeInTransaction ─────────────────────────────────────────────────

  describe('executeInTransaction', () => {
    it('runs all operations and returns results', async () => {
      const op1 = jest.fn().mockResolvedValue('result-1');
      const op2 = jest.fn().mockResolvedValue('result-2');

      const results = await service.executeInTransaction([op1, op2]);

      expect(results).toEqual(['result-1', 'result-2']);
      expect(op1).toHaveBeenCalledWith(queryRunner.manager);
      expect(op2).toHaveBeenCalledWith(queryRunner.manager);
      expect(queryRunner.connect).toHaveBeenCalledTimes(1);
      expect(queryRunner.startTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('rolls back and rethrows on operation failure', async () => {
      const failingOp = jest.fn().mockRejectedValue(new Error('db error'));

      await expect(service.executeInTransaction([failingOp])).rejects.toThrow('db error');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('releases query runner even when commit fails', async () => {
      queryRunner.commitTransaction.mockRejectedValue(new Error('commit failed'));

      await expect(
        service.executeInTransaction([jest.fn().mockResolvedValue('ok')]),
      ).rejects.toThrow('commit failed');
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('returns empty array for zero operations', async () => {
      const results = await service.executeInTransaction([]);
      expect(results).toEqual([]);
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    });
  });

  // ─── executeWithRollback ──────────────────────────────────────────────────

  describe('executeWithRollback', () => {
    it('runs operations sequentially and returns results', async () => {
      const op1 = jest.fn().mockResolvedValue('a');
      const op2 = jest.fn().mockResolvedValue('b');

      const results = await service.executeWithRollback([
        { operation: op1 },
        { operation: op2 },
      ]);

      expect(results).toEqual(['a', 'b']);
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    });

    it('skips operations when condition returns false', async () => {
      const op1 = jest.fn().mockResolvedValue('a');
      const op2 = jest.fn().mockResolvedValue('b');

      const results = await service.executeWithRollback([
        { operation: op1, condition: () => true },
        { operation: op2, condition: () => false },
      ]);

      expect(results).toEqual(['a']);
      expect(op1).toHaveBeenCalledTimes(1);
      expect(op2).not.toHaveBeenCalled();
    });

    it('runs operations without condition', async () => {
      const op = jest.fn().mockResolvedValue('x');

      const results = await service.executeWithRollback([{ operation: op }]);

      expect(results).toEqual(['x']);
    });

    it('rolls back and rethrows on operation failure', async () => {
      const op = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(
        service.executeWithRollback([{ operation: op }]),
      ).rejects.toThrow('fail');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('executes rollback functions on failure', async () => {
      const rollback = jest.fn().mockResolvedValue(undefined);
      const op = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(
        service.executeWithRollback([{ operation: op, rollback }]),
      ).rejects.toThrow('fail');
      expect(rollback).toHaveBeenCalledWith(queryRunner.manager);
    });

    it('handles rollback function failure gracefully', async () => {
      const rollback = jest.fn().mockRejectedValue(new Error('rollback failed'));
      const op = jest.fn().mockRejectedValue(new Error('original fail'));

      await expect(
        service.executeWithRollback([{ operation: op, rollback }]),
      ).rejects.toThrow('original fail');
      // rollback error is caught and logged, original error is rethrown
    });

    it('does not call rollback functions on success', async () => {
      const rollback = jest.fn();
      const op = jest.fn().mockResolvedValue('ok');

      await service.executeWithRollback([{ operation: op, rollback }]);

      expect(rollback).not.toHaveBeenCalled();
    });
  });

  // ─── createSavepoint ──────────────────────────────────────────────────────

  describe('createSavepoint', () => {
    it('creates a savepoint with valid name', async () => {
      const manager = { query: jest.fn().mockResolvedValue(undefined) } as unknown as EntityManager;

      await service.createSavepoint(manager, 'sp1');

      expect(manager.query).toHaveBeenCalledWith('SAVEPOINT sp1');
    });

    it('rejects invalid savepoint names', async () => {
      const manager = { query: jest.fn() } as unknown as EntityManager;

      await expect(service.createSavepoint(manager, '123bad')).rejects.toThrow(
        'Invalid savepoint name',
      );
      await expect(service.createSavepoint(manager, 'has space')).rejects.toThrow(
        'Invalid savepoint name',
      );
      await expect(service.createSavepoint(manager, '')).rejects.toThrow(
        'Invalid savepoint name',
      );
    });

    it('accepts underscore-prefixed names', async () => {
      const manager = { query: jest.fn().mockResolvedValue(undefined) } as unknown as EntityManager;

      await service.createSavepoint(manager, '_savepoint');

      expect(manager.query).toHaveBeenCalledWith('SAVEPOINT _savepoint');
    });
  });

  // ─── rollbackToSavepoint ──────────────────────────────────────────────────

  describe('rollbackToSavepoint', () => {
    it('rolls back to a savepoint with valid name', async () => {
      const manager = { query: jest.fn().mockResolvedValue(undefined) } as unknown as EntityManager;

      await service.rollbackToSavepoint(manager, 'sp1');

      expect(manager.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp1');
    });

    it('rejects invalid savepoint names', async () => {
      const manager = { query: jest.fn() } as unknown as EntityManager;

      await expect(service.rollbackToSavepoint(manager, 'bad-name!')).rejects.toThrow(
        'Invalid savepoint name',
      );
    });
  });

  // ─── releaseSavepoint ─────────────────────────────────────────────────────

  describe('releaseSavepoint', () => {
    it('releases a savepoint with valid name', async () => {
      const manager = { query: jest.fn().mockResolvedValue(undefined) } as unknown as EntityManager;

      await service.releaseSavepoint(manager, 'sp1');

      expect(manager.query).toHaveBeenCalledWith('RELEASE SAVEPOINT sp1');
    });

    it('rejects invalid savepoint names', async () => {
      const manager = { query: jest.fn() } as unknown as EntityManager;

      await expect(service.releaseSavepoint(manager, 'no spaces')).rejects.toThrow(
        'Invalid savepoint name',
      );
    });
  });

  // ─── isInTransaction ──────────────────────────────────────────────────────

  describe('isInTransaction', () => {
    it('returns true when transaction is active', () => {
      const manager = {
        queryRunner: { isTransactionActive: true },
      } as unknown as EntityManager;

      expect(service.isInTransaction(manager)).toBe(true);
    });

    it('returns false when transaction is not active', () => {
      const manager = {
        queryRunner: { isTransactionActive: false },
      } as unknown as EntityManager;

      expect(service.isInTransaction(manager)).toBe(false);
    });

    it('returns false when queryRunner is undefined', () => {
      const manager = { queryRunner: undefined } as unknown as EntityManager;

      expect(service.isInTransaction(manager)).toBe(false);
    });
  });

  // ─── getIsolationLevel ────────────────────────────────────────────────────

  describe('getIsolationLevel', () => {
    it('returns the isolation level from the database', async () => {
      const manager = {
        query: jest.fn().mockResolvedValue([{ level: 'REPEATABLE READ' }]),
      } as unknown as EntityManager;

      const level = await service.getIsolationLevel(manager);

      expect(level).toBe('REPEATABLE READ');
      expect(manager.query).toHaveBeenCalledWith('SHOW TRANSACTION ISOLATION LEVEL');
    });

    it('returns READ COMMITTED as fallback on error', async () => {
      const manager = {
        query: jest.fn().mockRejectedValue(new Error('not supported')),
      } as unknown as EntityManager;

      const level = await service.getIsolationLevel(manager);

      expect(level).toBe('READ COMMITTED');
    });

    it('returns READ COMMITTED when query returns empty result', async () => {
      const manager = {
        query: jest.fn().mockResolvedValue([]),
      } as unknown as EntityManager;

      const level = await service.getIsolationLevel(manager);

      expect(level).toBe('READ COMMITTED');
    });
  });

  // ─── setTransactionTimeout ────────────────────────────────────────────────

  describe('setTransactionTimeout', () => {
    it('sets lock timeout for valid integer', async () => {
      const manager = { query: jest.fn().mockResolvedValue(undefined) } as unknown as EntityManager;

      await service.setTransactionTimeout(manager, 5000);

      expect(manager.query).toHaveBeenCalledWith('SET lock_timeout = $1', ['5000']);
    });

    it('sets timeout for zero', async () => {
      const manager = { query: jest.fn().mockResolvedValue(undefined) } as unknown as EntityManager;

      await service.setTransactionTimeout(manager, 0);

      expect(manager.query).toHaveBeenCalledWith('SET lock_timeout = $1', ['0']);
    });

    it('rejects negative timeout', async () => {
      const manager = { query: jest.fn() } as unknown as EntityManager;

      await expect(service.setTransactionTimeout(manager, -1)).rejects.toThrow(
        'Invalid timeout value',
      );
    });

    it('rejects non-integer timeout', async () => {
      const manager = { query: jest.fn() } as unknown as EntityManager;

      await expect(service.setTransactionTimeout(manager, 1.5)).rejects.toThrow(
        'Invalid timeout value',
      );
      await expect(service.setTransactionTimeout(manager, NaN)).rejects.toThrow(
        'Invalid timeout value',
      );
    });
  });

  // ─── setStatementTimeout ──────────────────────────────────────────────────

  describe('setStatementTimeout', () => {
    it('sets statement timeout for valid integer', async () => {
      const manager = { query: jest.fn().mockResolvedValue(undefined) } as unknown as EntityManager;

      await service.setStatementTimeout(manager, 10000);

      expect(manager.query).toHaveBeenCalledWith('SET statement_timeout = $1', ['10000']);
    });

    it('sets timeout for zero', async () => {
      const manager = { query: jest.fn().mockResolvedValue(undefined) } as unknown as EntityManager;

      await service.setStatementTimeout(manager, 0);

      expect(manager.query).toHaveBeenCalledWith('SET statement_timeout = $1', ['0']);
    });

    it('rejects negative timeout', async () => {
      const manager = { query: jest.fn() } as unknown as EntityManager;

      await expect(service.setStatementTimeout(manager, -1)).rejects.toThrow(
        'Invalid timeout value',
      );
    });

    it('rejects non-integer timeout', async () => {
      const manager = { query: jest.fn() } as unknown as EntityManager;

      await expect(service.setStatementTimeout(manager, 2.5)).rejects.toThrow(
        'Invalid timeout value',
      );
    });
  });
});
