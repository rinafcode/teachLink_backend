import { ReadReplicaRoutingService } from './read-replica-routing.service';

function createQueryRunner(manager: unknown, connect = jest.fn(), release = jest.fn()) {
  return {
    manager,
    connect,
    release,
  };
}

describe('ReadReplicaRoutingService', () => {
  it('routes eventual reads through a replica connection', async () => {
    const manager = { source: 'replica' };
    const queryRunner = createQueryRunner(manager);
    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };
    const service = new ReadReplicaRoutingService(dataSource as any);

    const result = await service.read(async (entityManager) => entityManager);

    expect(dataSource.createQueryRunner).toHaveBeenCalledWith('slave');
    expect(result).toBe(manager);
    expect(queryRunner.connect).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('routes consistent reads through the primary connection', async () => {
    const manager = { source: 'primary' };
    const queryRunner = createQueryRunner(manager);
    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };
    const service = new ReadReplicaRoutingService(dataSource as any);

    const result = await service.consistentRead(async (entityManager) => entityManager);

    expect(dataSource.createQueryRunner).toHaveBeenCalledWith('master');
    expect(result).toBe(manager);
  });

  it('fails over replica reads to primary by default', async () => {
    const replicaRunner = createQueryRunner({ source: 'replica' }, jest.fn(), jest.fn());
    const primaryRunner = createQueryRunner({ source: 'primary' }, jest.fn(), jest.fn());
    const dataSource = {
      createQueryRunner: jest
        .fn()
        .mockReturnValueOnce(replicaRunner)
        .mockReturnValueOnce(primaryRunner),
    };
    const service = new ReadReplicaRoutingService(dataSource as any);
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('replica unavailable'))
      .mockResolvedValueOnce('primary-result');

    await expect(service.read(operation)).resolves.toBe('primary-result');

    expect(dataSource.createQueryRunner).toHaveBeenNthCalledWith(1, 'slave');
    expect(dataSource.createQueryRunner).toHaveBeenNthCalledWith(2, 'master');
    expect(replicaRunner.release).toHaveBeenCalled();
    expect(primaryRunner.release).toHaveBeenCalled();
  });
});
