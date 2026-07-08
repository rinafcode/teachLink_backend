import { Injectable, LoggerService } from '@nestjs/common';
import { createLogger, format, transports, Logger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { getCorrelationId } from '../common/utils/correlation.utils';
import { maskSensitiveData } from './sensitive-data.masker';

function buildJsonFormat() {
  return format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.printf((info) => {
      const correlationId = getCorrelationId();
      const entry: Record<string, unknown> = {
        timestamp: info.timestamp,
        level: info.level,
        service: process.env.SERVICE_NAME || 'teachlink-backend',
        pid: process.pid,
        ...(correlationId ? { correlationId } : {}),
        message: info.message,
      };

      if (info.stack) entry.stack = info.stack;

      const skip = new Set(['timestamp', 'level', 'message', 'stack', 'service']);
      const meta: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(info)) {
        if (!skip.has(k)) meta[k] = v;
      }
      if (Object.keys(meta).length > 0) {
        entry.meta = maskSensitiveData(meta);
      }

      return JSON.stringify(entry);
    }),
  );
}

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly winston: Logger;

  constructor() {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const logDir = process.env.LOG_DIR || 'logs';
    const enableFileLogging =
      process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true';

    const jsonFormat = buildJsonFormat();

    const transportList: (transports.ConsoleTransportInstance | DailyRotateFile)[] = [
      new transports.Console({ format: jsonFormat }),
    ];

    if (enableFileLogging) {
      transportList.push(
        new DailyRotateFile({
          filename: `${logDir}/app-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: jsonFormat,
        }),
      );

      transportList.push(
        new DailyRotateFile({
          filename: `${logDir}/error-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '30d',
          format: jsonFormat,
        }),
      );
    }

    this.winston = createLogger({ level: logLevel, transports: transportList });
  }

  log(message: string, context?: string): void {
    this.winston.info(message, { context });
  }

  error(message: string, trace?: string, context?: string): void {
    this.winston.error(message, { context, stack: trace });
  }

  warn(message: string, context?: string): void {
    this.winston.warn(message, { context });
  }

  debug(message: string, context?: string): void {
    this.winston.debug(message, { context });
  }

  verbose(message: string, context?: string): void {
    this.winston.verbose(message, { context });
  }

  logRequest(meta: Record<string, unknown>): void {
    this.winston.info('http_request', meta);
  }

  logResponse(meta: Record<string, unknown>): void {
    this.winston.info('http_response', meta);
  }
}
