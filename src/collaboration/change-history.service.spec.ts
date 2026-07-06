import { Test, TestingModule } from '@nestjs/testing';
import { ChangeHistoryService } from './change-history.service';
import { Operation } from './ot-crdt.service';

const makeOp = (revision: number, sessionId = 's1'): Operation => ({
  type: 'insert',
  position: 0,
  content: 'x',
  userId: 'u1',
  sessionId,
  revision,
});

describe('ChangeHistoryService', () => {
  let service: ChangeHistoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChangeHistoryService],
    }).compile();
    service = module.get(ChangeHistoryService);
  });

  describe('record', () => {
    it('stores an entry', () => {
      service.record(makeOp(1));
      expect(service.getHistory('s1')).toHaveLength(1);
    });

    it('stores entries for different sessions independently', () => {
      service.record(makeOp(1, 's1'));
      service.record(makeOp(1, 's2'));
      expect(service.getHistory('s1')).toHaveLength(1);
      expect(service.getHistory('s2')).toHaveLength(1);
    });
  });

  describe('getHistory', () => {
    beforeEach(() => {
      service.record(makeOp(1));
      service.record(makeOp(2));
      service.record(makeOp(3));
    });

    it('returns all entries from revision 0', () => {
      expect(service.getHistory('s1')).toHaveLength(3);
    });

    it('filters entries after fromRevision', () => {
      expect(service.getHistory('s1', 1)).toHaveLength(2); // rev 2 and 3
    });

    it('returns empty for unknown session', () => {
      expect(service.getHistory('unknown')).toEqual([]);
    });
  });

  describe('getLatest', () => {
    it('returns last N entries', () => {
      for (let i = 1; i <= 5; i++) service.record(makeOp(i));
      const latest = service.getLatest('s1', 3);
      expect(latest).toHaveLength(3);
      expect(latest[0].revision).toBe(3);
    });
  });

  describe('clear', () => {
    it('removes all history for session', () => {
      service.record(makeOp(1));
      service.clear('s1');
      expect(service.getHistory('s1')).toHaveLength(0);
    });
  });
});
