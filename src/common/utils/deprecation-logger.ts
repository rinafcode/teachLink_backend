import { Logger } from '@nestjs/common';

export class DeprecationLogger {
  private static readonly logger = new Logger('DeprecationLogger');

  static warn(feature: string, reason: string, removalVersion: string) {
    this.logger.warn(`${feature} is deprecated. Reason: ${reason}. Removal: ${removalVersion}`);
  }
}
