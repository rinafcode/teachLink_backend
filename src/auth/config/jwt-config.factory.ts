import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';
import * as fs from 'fs';

/**
 * Resolves a key value, reading from disk if passed a valid file path,
 * or returning the raw string (handling escaped newlines) if provided inline.
 */
export function loadPEMKey(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const stats = fs.statSync(value);
    if (stats.isFile()) {
      return fs.readFileSync(value, 'utf8');
    }
  } catch {
    // Not a file path; treat as raw PEM string content
  }

  return value.replace(/\\n/g, '\n');
}

/**
 * Checks whether RS256 asymmetric signing is configured.
 */
export function isRS256Configured(configService?: ConfigService): boolean {
  const privateKey = configService
    ? configService.get<string>('JWT_PRIVATE_KEY')
    : process.env.JWT_PRIVATE_KEY;
  const publicKey = configService
    ? configService.get<string>('JWT_PUBLIC_KEY')
    : process.env.JWT_PUBLIC_KEY;

  return Boolean(privateKey || publicKey);
}

/**
 * Validates startup JWT configuration to ensure RS256 and HS256 settings are mutually exclusive
 * and that required key pairs/secrets are fully provided.
 */
export function validateJwtConfig(configService?: ConfigService): void {
  const hasRS256 = isRS256Configured(configService);

  const privateKeyRaw = configService
    ? configService.get<string>('JWT_PRIVATE_KEY')
    : process.env.JWT_PRIVATE_KEY;
  const publicKeyRaw = configService
    ? configService.get<string>('JWT_PUBLIC_KEY')
    : process.env.JWT_PUBLIC_KEY;

  const secret = configService ? configService.get<string>('JWT_SECRET') : process.env.JWT_SECRET;
  const refreshSecret = configService
    ? configService.get<string>('JWT_REFRESH_SECRET')
    : process.env.JWT_REFRESH_SECRET;

  const hasHS256 = Boolean(secret || refreshSecret);

  // Reject mixed configuration
  if (hasRS256 && hasHS256) {
    throw new Error(
      'Invalid JWT Configuration: Cannot mix RS256 (JWT_PRIVATE_KEY/JWT_PUBLIC_KEY) and HS256 (JWT_SECRET/JWT_REFRESH_SECRET) parameters.',
    );
  }

  // Reject incomplete RS256 configuration
  if (hasRS256 && (!privateKeyRaw || !publicKeyRaw)) {
    throw new Error(
      'Invalid JWT Configuration: Both JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be provided for RS256 configuration.',
    );
  }

  // Reject missing configuration
  if (!hasRS256 && !hasHS256) {
    throw new Error('Invalid JWT Configuration: Must specify either RS256 keys or HS256 secrets.');
  }
}

/**
 * Retrieves the signing key for token generation (RS256 private key or HS256 secret).
 */
export function getSigningKey(configService?: ConfigService): string {
  const isRS256 = isRS256Configured(configService);

  if (isRS256) {
    const rawPrivateKey = configService
      ? configService.get<string>('JWT_PRIVATE_KEY')
      : process.env.JWT_PRIVATE_KEY;
    const resolvedKey = loadPEMKey(rawPrivateKey);
    if (!resolvedKey) {
      throw new Error('JWT_PRIVATE_KEY is configured but could not be resolved.');
    }
    return resolvedKey;
  }

  const secret = configService ? configService.get<string>('JWT_SECRET') : process.env.JWT_SECRET;

  return secret || '';
}

/**
 * Retrieves the verification key for token validation (RS256 public key or HS256 secret).
 */
export function getVerificationKey(configService?: ConfigService): string {
  const isRS256 = isRS256Configured(configService);

  if (isRS256) {
    const rawPublicKey = configService
      ? configService.get<string>('JWT_PUBLIC_KEY')
      : process.env.JWT_PUBLIC_KEY;
    const resolvedKey = loadPEMKey(rawPublicKey);
    if (!resolvedKey) {
      throw new Error('JWT_PUBLIC_KEY is configured but could not be resolved.');
    }
    return resolvedKey;
  }

  const secret = configService ? configService.get<string>('JWT_SECRET') : process.env.JWT_SECRET;

  return secret || '';
}

/**
 * Factory for NestJS JwtModule async configuration options.
 */
export function createJwtOptions(configService: ConfigService): JwtModuleOptions {
  validateJwtConfig(configService);

  const expiresIn = (configService.get<string>('JWT_EXPIRES_IN') || '15m') as any;

  if (isRS256Configured(configService)) {
    return {
      privateKey: getSigningKey(configService),
      publicKey: getVerificationKey(configService),
      signOptions: {
        algorithm: 'RS256',
        expiresIn,
      },
      verifyOptions: {
        algorithms: ['RS256'],
      },
    };
  }

  return {
    secret: getSigningKey(configService),
    signOptions: {
      algorithm: 'HS256',
      expiresIn,
    },
    verifyOptions: {
      algorithms: ['HS256'],
    },
  };
}
