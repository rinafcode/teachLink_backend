import { Injectable, Logger } from '@nestjs/common';

export interface IAnonymizationOptions {
  fieldsToAnonymize?: string[];
  keepEmailDomain?: boolean;
  hashIdentifiers?: boolean;
}

@Injectable()
export class DataAnonymizationService {
  private readonly logger = new Logger(DataAnonymizationService.name);

  /**
   * Anonymize user data for export
   */
  anonymizeUserData(data: Record<string, any>, options: IAnonymizationOptions = {}): Record<string, any> {
    const {
      fieldsToAnonymize = ['email', 'firstName', 'lastName', 'phone', 'address'],
      keepEmailDomain = true,
      hashIdentifiers = true,
    } = options;

    const anonymized = { ...data };

    // Anonymize specified fields
    fieldsToAnonymize.forEach((field) => {
      if (anonymized[field]) {
        anonymized[field] = this.anonymizeField(anonymized[field], field, keepEmailDomain);
      }
    });

    // Hash identifiers if requested
    if (hashIdentifiers && anonymized.id) {
      anonymized.id = this.hashValue(anonymized.id);
    }

    return anonymized;
  }

  /**
   * Anonymize email while keeping domain for analytics
   */
  private anonymizeEmail(email: string, keepDomain: boolean): string {
    if (!keepDomain) {
      return this.hashValue(email);
    }

    const [username, domain] = email.split('@');
    if (!domain) {
      return this.hashValue(email);
    }

    // Keep first character and hash the rest of username
    const anonymizedUsername = username.length > 1
      ? username[0] + '*'.repeat(username.length - 1)
      : '*';

    return `${anonymizedUsername}@${domain}`;
  }

  /**
   * Anonymize a specific field based on its type
   */
  private anonymizeField(value: string, fieldName: string, keepEmailDomain: boolean): string {
    if (fieldName === 'email') {
      return this.anonymizeEmail(value, keepEmailDomain);
    }

    // For names and other text fields, provide anonymized version
    if (typeof value === 'string') {
      if (value.length <= 2) {
        return '*'.repeat(value.length);
      }
      return value[0] + '*'.repeat(value.length - 1);
    }

    return this.hashValue(String(value));
  }

  /**
   * Hash a value using simple hash function
   * In production, use bcrypt or similar secure hashing
   */
  private hashValue(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return `hash_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Anonymize an array of records
   */
  anonymizeRecords(
    records: Record<string, any>[],
    options: IAnonymizationOptions = {},
  ): Record<string, any>[] {
    return records.map((record) => this.anonymizeUserData(record, options));
  }

  /**
   * Check if data contains PII (Personally Identifiable Information)
   */
  containsPII(data: Record<string, any>): boolean {
    const piiFields = [
      'email',
      'firstName',
      'lastName',
      'phone',
      'address',
      'ssn',
      'dateOfBirth',
      'creditCard',
    ];

    return piiFields.some((field) => field in data && data[field] !== null && data[field] !== undefined);
  }

  /**
   * Remove PII fields entirely from data
   */
  removePII(data: Record<string, any>, fieldsToRemove?: string[]): Record<string, any> {
    const fields = fieldsToRemove || [
      'email',
      'firstName',
      'lastName',
      'phone',
      'address',
      'ssn',
      'dateOfBirth',
      'creditCard',
    ];

    const sanitized = { ...data };
    fields.forEach((field) => {
      delete sanitized[field];
    });

    return sanitized;
  }
}
