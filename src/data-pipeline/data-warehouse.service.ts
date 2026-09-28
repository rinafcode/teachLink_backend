import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EtlRecord } from './etl.service';

export interface WarehouseEntry {
  id: string;
  source: string;
  data: Record<string, unknown>;
  storedAt: Date;
}

export interface WarehouseQueryOptions {
  source?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

@Injectable()
export class DataWarehouseService {
  private readonly logger = new Logger(DataWarehouseService.name);
  // In-memory store; replace with a real DB/warehouse adapter as needed
  private readonly store: WarehouseEntry[] = [];

  @OnEvent('etl.record.loaded')
  handleEtlRecord(record: EtlRecord): void {
    this.ingest(record);
  }

  ingest(record: EtlRecord): void {
    const entry: WarehouseEntry = {
      id: record.id,
      source: record.source,
      data: record.payload,
      storedAt: new Date(),
    };
    this.store.push(entry);
    this.logger.debug(`Ingested record id=${record.id} source=${record.source}`);
  }

  query(options: WarehouseQueryOptions = {}): WarehouseEntry[] {
    const { source, from, to, limit = 100 } = options;
    let results = this.store;

    if (source) results = results.filter((e) => e.source === source);
    if (from) results = results.filter((e) => e.storedAt >= from);
    if (to) results = results.filter((e) => e.storedAt <= to);

    return results.slice(-limit);
  }

  aggregate(source?: string): Record<string, number> {
    const entries = source ? this.store.filter((e) => e.source === source) : this.store;
    const counts: Record<string, number> = {};
    for (const entry of entries) {
      counts[entry.source] = (counts[entry.source] ?? 0) + 1;
    }
    return counts;
  }

  count(): number {
    return this.store.length;
  }
}
