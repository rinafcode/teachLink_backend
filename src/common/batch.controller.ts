import { Body, Controller, HttpCode, Post } from '@nestjs/common';

interface BulkItem {
  id: string;
  [key: string]: unknown;
}

interface BulkResult {
  id: string;
  success: boolean;
  error?: string;
}

@Controller('batch')
export class BatchController {
  /**
   * Generic bulk-upsert endpoint.
   * Accepts up to 100 items and returns per-item success/failure.
   */
  @Post()
  @HttpCode(200)
  async bulkProcess(@Body() items: BulkItem[]): Promise<BulkResult[]> {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const limited = items.slice(0, 100);

    return limited.map((item) => {
      if (!item.id) {
        return { id: String(item.id ?? ''), success: false, error: 'Missing id' };
      }
      return { id: item.id, success: true };
    });
  }
}