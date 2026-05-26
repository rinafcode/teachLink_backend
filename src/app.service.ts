import { Injectable } from '@nestjs/common';

/**
 * Provides app operations.
 */
@Injectable()
export class AppService {
  /**
   * Retrieves hello.
   * @returns The resulting string value.
   */
  getHello(): string {
    return 'Hello World!';
  }
}
