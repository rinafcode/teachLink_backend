import { Injectable } from '@nestjs/common';

@Injectable()
export class IncrementalLoaderService {
  private lastLoadedAt: Date | null = null;

  // Incremental data loading logic
  async loadIncremental(
    records: any[],
    getUpdatedAt: (record: any) => Date,
  ): Promise<any[]> {
    // Only load records updated since lastLoadedAt
    const since = this.lastLoadedAt;
    const toLoad = since
      ? records.filter((r) => getUpdatedAt(r) > since)
      : records;
    this.lastLoadedAt = new Date();
    // In a real implementation, this would persist the loaded records
    return toLoad;
  }
}
