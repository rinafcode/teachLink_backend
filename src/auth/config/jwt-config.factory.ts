import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';
import * as fs from 'fs';

export function loadPEMKey(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const stats = fs.statSync(value);
    if (stats.isFile()) {
      return fs.readFileSync(value, 'utf8');
    }
  } catch {
    // Not a file path, treat as inline PEM content
  }

  return value;
}

export function isRS256Configured(): boolean {
  return !!(process.env.JWT_PRIVATE_KEY || process.env.JWT_PUBLIC_KEY);
}

export function getSigningKey(): string | Buffer {
  const key = process.env.JWT_PRIVATE_KEY || process.env.JWT_SECRET || 'default-jwt-secret';
  if (isRS256Configured()) {
    return loadPEMKey(key) || key;
  }
  return key;
}

export function getVerificationKey(): string | Buffer {
  if (isRS256Configured()) {
    const pubKey = process.env.JWT_PUBLIC_KEY || '';
    return loadPEMKey(pubKey) || pubKey;
  }
  return process.env.JWT_SECRET || 'default-jwt-secret';
}

export function createJwtOptions(configService: ConfigService): JwtModuleOptions {
  const privateKeyRaw = configService.get<string>('JWT_PRIVATE_KEY');
  const publicKeyRaw = configService.get<string>('JWT_PUBLIC_KEY');
  const expiresIn = (configService.get<string>('JWT_EXPIRES_IN') || '15m') as any;

  if (privateKeyRaw || publicKeyRaw) {
    const privateKey = loadPEMKey(privateKeyRaw) || privateKeyRaw;
    const publicKey = loadPEMKey(publicKeyRaw) || publicKeyRaw;

    return {
      privateKey,
      publicKey,
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
    secret: configService.get<string>('JWT_SECRET') || 'default-jwt-secret',
    signOptions: {
      algorithm: 'HS256',
      expiresIn,
    },
  };
}
