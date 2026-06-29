import { Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { BYTES } from '../../common/constants/time.constants';

/**
 * Default maximum WebSocket payload size in bytes (64KB).
 * Can be overridden via the WS_MAX_PAYLOAD_BYTES environment variable.
 */
export const DEFAULT_WS_MAX_PAYLOAD_BYTES = BYTES.SIXTY_FOUR_KB;

/**
 * Error code returned when a WebSocket message exceeds the size limit.
 */
export const WS_PAYLOAD_TOO_LARGE_CODE = 'PAYLOAD_TOO_LARGE';

/**
 * Service that validates WebSocket message payload sizes.
 *
 * Provides application-level defense-in-depth on top of the transport-level
 * `maxHttpBufferSize` configured in main.ts. This ensures that even if the
 * transport-level limit is relaxed for other namespaces, collaboration
 * handlers still enforce their own limit and return a proper WsException.
 */
@Injectable()
export class WsPayloadSizeGuardService {
  private readonly logger = new Logger(WsPayloadSizeGuardService.name);
  private readonly maxPayloadBytes: number;

  constructor(private readonly configService: ConfigService) {
    this.maxPayloadBytes =
      this.configService.get<number>('WS_MAX_PAYLOAD_BYTES') ?? DEFAULT_WS_MAX_PAYLOAD_BYTES;

    this.logger.log(
      `WebSocket payload size limit: ${this.maxPayloadBytes} bytes (${Math.round(this.maxPayloadBytes / 1024)}KB)`,
    );
  }

  /**
   * Validate that a payload does not exceed the configured size limit.
   *
   * @param payload - The message payload to validate (any shape).
   * @throws WsException with code PAYLOAD_TOO_LARGE if the payload is too large.
   */
  validate(payload: unknown): void {
    const serialized = JSON.stringify(payload);
    const byteLength = Buffer.byteLength(serialized, 'utf8');

    if (byteLength > this.maxPayloadBytes) {
      this.logger.warn(
        `Rejected oversized WebSocket payload: ${byteLength} bytes (limit: ${this.maxPayloadBytes} bytes)`,
      );
      throw new WsException({
        code: WS_PAYLOAD_TOO_LARGE_CODE,
        message: `Payload size ${byteLength} bytes exceeds the maximum allowed size of ${this.maxPayloadBytes} bytes`,
      });
    }
  }

  /**
   * Get the currently configured max payload size in bytes.
   */
  getMaxPayloadBytes(): number {
    return this.maxPayloadBytes;
  }
}
