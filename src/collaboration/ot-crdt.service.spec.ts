import { Test, TestingModule } from '@nestjs/testing';
import { OtCrdtService, Operation } from './ot-crdt.service';

const makeOp = (overrides: Partial<Operation> = {}): Operation => ({
  type: 'insert',
  position: 0,
  content: 'a',
  userId: 'u1',
  sessionId: 's1',
  revision: 1,
  ...overrides,
});

describe('OtCrdtService', () => {
  let service: OtCrdtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OtCrdtService],
    }).compile();
    service = module.get(OtCrdtService);
  });

  describe('nextRevision / currentRevision', () => {
    it('starts at 0', () => expect(service.currentRevision('s1')).toBe(0));
    it('increments on each call', () => {
      expect(service.nextRevision('s1')).toBe(1);
      expect(service.nextRevision('s1')).toBe(2);
      expect(service.currentRevision('s1')).toBe(2);
    });
    it('tracks sessions independently', () => {
      service.nextRevision('s1');
      expect(service.currentRevision('s2')).toBe(0);
    });
  });

  describe('transform', () => {
    it('returns untransformed when sessions differ', () => {
      const op = makeOp({ sessionId: 's1' });
      const against = makeOp({ sessionId: 's2' });
      const result = service.transform(op, against);
      expect(result.transformed).toBe(false);
      expect(result.operation).toEqual(op);
    });

    it('insert vs insert: shifts position when against is before', () => {
      const op = makeOp({ type: 'insert', position: 5, content: 'x' });
      const against = makeOp({ type: 'insert', position: 3, content: 'ab' });
      const result = service.transform(op, against);
      expect(result.operation.position).toBe(7); // 5 + 2
    });

    it('insert vs insert: no shift when against is after', () => {
      const op = makeOp({ type: 'insert', position: 3, content: 'x' });
      const against = makeOp({ type: 'insert', position: 5, content: 'ab' });
      const result = service.transform(op, against);
      expect(result.operation.position).toBe(3);
    });

    it('insert vs delete: shifts position back', () => {
      const op = makeOp({ type: 'insert', position: 5 });
      const against = makeOp({ type: 'delete', position: 2, length: 2 });
      const result = service.transform(op, against);
      expect(result.operation.position).toBe(3); // 5 - 2
    });

    it('delete vs insert: shifts position forward', () => {
      const op = makeOp({ type: 'delete', position: 5, length: 1 });
      const against = makeOp({ type: 'insert', position: 3, content: 'ab' });
      const result = service.transform(op, against);
      expect(result.operation.position).toBe(7);
    });

    it('delete vs delete same position: zeroes length', () => {
      const op = makeOp({ type: 'delete', position: 3, length: 2 });
      const against = makeOp({ type: 'delete', position: 3, length: 2 });
      const result = service.transform(op, against);
      expect(result.operation.length).toBe(0);
    });
  });

  describe('resolveConflict', () => {
    it('picks higher revision', () => {
      const op1 = makeOp({ revision: 3 });
      const op2 = makeOp({ revision: 5 });
      expect(service.resolveConflict(op1, op2)).toEqual(op2);
    });

    it('tie-breaks by userId lexicographic order', () => {
      const op1 = makeOp({ revision: 2, userId: 'alice' });
      const op2 = makeOp({ revision: 2, userId: 'bob' });
      expect(service.resolveConflict(op1, op2)).toEqual(op1); // 'alice' <= 'bob'
    });
  });
});
