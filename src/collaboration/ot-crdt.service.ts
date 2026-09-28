import { Injectable, Logger } from '@nestjs/common';

export type OperationType = 'insert' | 'delete' | 'retain';

export interface Operation {
  type: OperationType;
  position: number;
  content?: string;
  length?: number;
  userId: string;
  sessionId: string;
  revision: number;
}

export interface TransformResult {
  operation: Operation;
  transformed: boolean;
}

@Injectable()
export class OtCrdtService {
  private readonly logger = new Logger(OtCrdtService.name);
  // revision counter per session
  private readonly revisions = new Map<string, number>();

  /**
   * Operational Transformation: transform op against a concurrent op
   * so both can be applied in any order and converge to the same state.
   */
  transform(op: Operation, against: Operation): TransformResult {
    if (op.sessionId !== against.sessionId) {
      return { operation: op, transformed: false };
    }

    const transformed = { ...op };

    if (op.type === 'insert' && against.type === 'insert') {
      if (against.position <= op.position) {
        transformed.position += against.content?.length ?? 0;
      }
    } else if (op.type === 'insert' && against.type === 'delete') {
      if (against.position < op.position) {
        transformed.position = Math.max(against.position, op.position - (against.length ?? 0));
      }
    } else if (op.type === 'delete' && against.type === 'insert') {
      if (against.position <= op.position) {
        transformed.position += against.content?.length ?? 0;
      }
    } else if (op.type === 'delete' && against.type === 'delete') {
      if (against.position < op.position) {
        transformed.position = Math.max(against.position, op.position - (against.length ?? 0));
      } else if (against.position === op.position) {
        // same position delete — idempotent, skip
        transformed.length = 0;
      }
    }

    return { operation: transformed, transformed: true };
  }

  /**
   * Resolve conflict between two concurrent operations.
   * Last-writer-wins by userId lexicographic order for determinism.
   */
  resolveConflict(op1: Operation, op2: Operation): Operation {
    this.logger.debug(`Resolving conflict: rev=${op1.revision} vs rev=${op2.revision}`);
    if (op1.revision !== op2.revision) {
      return op1.revision > op2.revision ? op1 : op2;
    }
    // same revision — deterministic tie-break
    return op1.userId <= op2.userId ? op1 : op2;
  }

  nextRevision(sessionId: string): number {
    const rev = (this.revisions.get(sessionId) ?? 0) + 1;
    this.revisions.set(sessionId, rev);
    return rev;
  }

  currentRevision(sessionId: string): number {
    return this.revisions.get(sessionId) ?? 0;
  }
}
