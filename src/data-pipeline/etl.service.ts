import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface EtlRecord {
  id: string;
  source: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}

export interface EtlResult {
  extracted: number;
  transformed: number;
  loaded: number;
  errors: number;
}

@Injectable()
export class EtlService {
  private readonly logger = new Logger(EtlService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  extract(source: string, rawData: Record<string, unknown>[]): EtlRecord[] {
    return rawData.map((item, index) => ({
      id: `${source}-${Date.now()}-${index}`,
      source,
      payload: item,
      timestamp: new Date(),
    }));
  }

  transform(records: EtlRecord[]): EtlRecord[] {
    return records
      .filter((r) => r.payload && Object.keys(r.payload).length > 0)
      .map((r) => ({
        ...r,
        payload: {
          ...r.payload,
          _processedAt: new Date().toISOString(),
          _source: r.source,
        },
      }));
  }

  async load(records: EtlRecord[]): Promise<void> {
    // Emit each record for downstream consumers (warehouse, BI, dashboards)
    for (const record of records) {
      this.eventEmitter.emit('etl.record.loaded', record);
    }
  }

  async run(source: string, rawData: Record<string, unknown>[]): Promise<EtlResult> {
    const result: EtlResult = { extracted: 0, transformed: 0, loaded: 0, errors: 0 };

    try {
      const extracted = this.extract(source, rawData);
      result.extracted = extracted.length;

      const transformed = this.transform(extracted);
      result.transformed = transformed.length;

      await this.load(transformed);
      result.loaded = transformed.length;

      this.logger.log(`ETL run complete: source=${source} ${JSON.stringify(result)}`);
      this.eventEmitter.emit('etl.run.complete', { source, result });
    } catch (err) {
      result.errors++;
      this.logger.error('ETL run failed', err as Error);
    }

    return result;
  }
}
