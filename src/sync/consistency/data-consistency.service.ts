import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue.constants';
import { APP_EVENTS } from '../../common/constants/event.constants';
import { TIME } from '../../common/constants/time.constants';

export interface IntegrityCheckResult {
  consistent: boolean;
  issues: string[];
  timestamp: Date;
}

type IntegrityComparable = {
  id?: string;
  version?: number;
};

/**
 * Provides data Consistency operations.
 */
@Injectable()
export class DataConsistencyService {
  private readonly logger = new Logger(DataConsistencyService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(QUEUE_NAMES.SYNC_TASKS) private readonly syncQueue: Queue,
  ) {}

  async scheduleConsistencyTask(dataId: string, payload: unknown): Promise<void> {
    this.logger.log(`Scheduling consistency task for ${dataId}`);

    await this.syncQueue.add(
      JOB_NAMES.CONSISTENCY_CHECK,
      {
        dataId,
        payload,
        timestamp: new Date(),
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: TIME.ONE_SECOND_MS,
        },
      },
    );

    this.eventEmitter.emit(APP_EVENTS.DATA_CONSISTENCY_SCHEDULED, {
      dataId,
      timestamp: new Date(),
    });
  }

  async performIntegrityCheck(
    sourceA: IntegrityComparable,
    sourceB: IntegrityComparable,
  ): Promise<IntegrityCheckResult> {
    this.logger.log('Performing data integrity check');
    const issues: string[] = [];

    if (sourceA.id !== sourceB.id) {
      issues.push(`ID mismatch: ${sourceA.id} vs ${sourceB.id}`);
    }

    if (sourceA.version !== undefined && sourceB.version !== undefined) {
      if (Math.abs(sourceA.version - sourceB.version) > 1) {
        issues.push(`Version drift too large: ${sourceA.version} vs ${sourceB.version}`);
      }
    }

    const consistent = issues.length === 0;
    if (!consistent) {
      this.logger.warn(`Integrity check failed with issues: ${issues.join(', ')}`);
      this.eventEmitter.emit(APP_EVENTS.DATA_INTEGRITY_VIOLATION, {
        issues,
        timestamp: new Date(),
      });
    }

    return {
      consistent,
      issues,
      timestamp: new Date(),
    };
  }

  async heal(
    _staleData: unknown,
    sourceOfTruth: Record<string, unknown> & { id?: string },
  ): Promise<Record<string, unknown>> {
    this.logger.log(`Healing data for ID: ${sourceOfTruth.id}`);
    return {
      ...sourceOfTruth,
      _recoveredAt: new Date(),
    };
  }
}
