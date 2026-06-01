import { Logger } from '@nestjs/common';

const logger = new Logger('Deprecation');

export interface DeprecatedOptions {
  reason: string;
  removalVersion: string;
}

export function Deprecated(options: DeprecatedOptions) {
  return (
    target: any,
    propertyKey?: string,
    descriptor?: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor?.value;

    if (originalMethod) {
      descriptor.value = function (...args: any[]) {
        logger.warn(
          `[DEPRECATED] ${propertyKey} - ${options.reason}. Scheduled removal: ${options.removalVersion}`,
        );

        return originalMethod.apply(this, args);
      };
    }

    Reflect.defineMetadata('deprecated', options, target);
  };
}