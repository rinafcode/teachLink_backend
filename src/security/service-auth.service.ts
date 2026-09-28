import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { AuditLoggingService } from './audit/audit-logging.service';

/**
 * Metadata attached to each registered service identity.
 */
export interface ServiceIdentity {
  /** Human-readable service name (e.g. "notifications-service"). */
  name: string;
  /** HMAC-SHA256 shared secret (should be stored in a secrets manager). */
  secret: string;
}

/**
 * ServiceAuthService handles service-to-service authentication using
 * HMAC-signed tokens.
 *
 * ### Token format
 *
 *   <serviceId>.<timestamp>.<nonce>.<signature>
 *
 * All four segments are dot-delimited.  The signature covers
 * `<serviceId>:<timestamp>:<nonce>` using HMAC-SHA256 with the
 * service-specific shared secret.
 *
 * ### Replay protection
 * Tokens older than `TOKEN_MAX_AGE_MS` (5 minutes) are rejected.
 * The nonce is a cryptographically random hex string that prevents
 * exact-replay of a captured token within the validity window.
 *
 * ### Encryption in transit / at rest
 * Secrets are never logged.  All comparisons are timing-safe.
 */
@Injectable()
export class ServiceAuthService {
  private static readonly TOKEN_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

  private readonly logger = new Logger(ServiceAuthService.name);

  /**
   * Registered service identities, keyed by serviceId.
   * In production these secrets should come from a secrets manager
   * (e.g. AWS Secrets Manager or HashiCorp Vault).
   */
  private readonly services = new Map<string, ServiceIdentity>();

  constructor(private readonly auditLogging: AuditLoggingService) {
    this.loadServiceIdentitiesFromEnv();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Registers a service identity so that it can issue and verify tokens.
   * Intended for use in tests and bootstrapping.
   */
  registerService(serviceId: string, identity: ServiceIdentity): void {
    this.services.set(serviceId, identity);
  }

  /**
   * Generates a short-lived HMAC service token for the given serviceId.
   * Returns `null` when the serviceId is unknown.
   */
  generateServiceToken(serviceId: string): string | null {
    const identity = this.services.get(serviceId);
    if (!identity) {
      this.logger.warn(`generateServiceToken: unknown serviceId "${serviceId}"`);
      return null;
    }

    const timestamp = Date.now().toString();
    const nonce = randomBytes(16).toString('hex');
    const payload = `${serviceId}:${timestamp}:${nonce}`;
    const signature = createHmac('sha256', identity.secret).update(payload).digest('hex');

    return `${serviceId}.${timestamp}.${nonce}.${signature}`;
  }

  /**
   * Verifies a service token.
   * @returns `true` when the token is valid, not expired, and the signature matches.
   */
  verifyServiceToken(token: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 4) {
      this.logger.debug('verifyServiceToken: malformed token (expected 4 segments)');
      return false;
    }

    const [serviceId, timestamp, nonce, signature] = parts;

    const identity = this.services.get(serviceId);
    if (!identity) {
      this.logger.debug(`verifyServiceToken: unknown serviceId "${serviceId}"`);
      return false;
    }

    // Replay protection — reject tokens older than TOKEN_MAX_AGE_MS.
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (Number.isNaN(tokenAge) || tokenAge > ServiceAuthService.TOKEN_MAX_AGE_MS || tokenAge < 0) {
      this.logger.debug(
        `verifyServiceToken: token expired or clock-skew detected (age=${tokenAge}ms)`,
      );
      return false;
    }

    // Timing-safe signature comparison.
    const payload = `${serviceId}:${timestamp}:${nonce}`;
    const expected = createHmac('sha256', identity.secret).update(payload).digest('hex');

    try {
      const isValid = timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));

      if (isValid) {
        this.auditLogging.log('SERVICE_AUTH_SUCCESS', { serviceId, serviceName: identity.name });
      } else {
        this.auditLogging.log('SERVICE_AUTH_FAILURE', {
          serviceId,
          reason: 'signature_mismatch',
        });
      }

      return isValid;
    } catch {
      this.auditLogging.log('SERVICE_AUTH_FAILURE', {
        serviceId,
        reason: 'verification_error',
      });
      return false;
    }
  }

  /**
   * Returns the display name for a registered serviceId, or `null` if unknown.
   */
  getServiceName(serviceId: string): string | null {
    return this.services.get(serviceId)?.name ?? null;
  }

  /** Returns the number of registered service identities. */
  getRegisteredServiceCount(): number {
    return this.services.size;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Loads service identities from environment variables.
   *
   * Expected format (JSON string):
   *   SERVICE_IDENTITIES='[{"id":"svc-a","name":"Service A","secret":"..."}]'
   */
  private loadServiceIdentitiesFromEnv(): void {
    const raw = process.env.SERVICE_IDENTITIES;
    if (!raw) {
      return;
    }

    try {
      const entries = JSON.parse(raw) as Array<{ id: string; name: string; secret: string }>;
      for (const entry of entries) {
        if (entry.id && entry.name && entry.secret) {
          this.services.set(entry.id, { name: entry.name, secret: entry.secret });
        }
      }
      this.logger.log(
        `Loaded ${this.services.size} service identit${this.services.size === 1 ? 'y' : 'ies'} from environment`,
      );
    } catch (err: any) {
      this.logger.warn(`Failed to parse SERVICE_IDENTITIES: ${err.message}`);
    }
  }
}
