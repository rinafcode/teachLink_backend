// src/common/naming/naming.service.ts

import { Injectable } from '@nestjs/common';

@Injectable()
export class NamingService {
  toCamelCase(input: string): string {
    return input.toLowerCase().replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
  }

  toSnakeCase(input: string): string {
    return input.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, '');
  }

  toPascalCase(input: string): string {
    return input.replace(/(^\w|[-_\s]+\w)/g, (word) => word.replace(/[-_\s]+/, '').toUpperCase());
  }

  toKebabCase(input: string): string {
    return input.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, '');
  }

  normalizeKey(input: string): string {
    // Example: enforce DB-safe keys
    return this.toSnakeCase(input).replace(/[^a-z0-9_]/g, '');
  }
}
