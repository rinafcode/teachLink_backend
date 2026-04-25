import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  email: string;
  role?: string;
  roles?: string[];
  sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKeyProvider: (
        req: Request,
        rawJwtToken: string,
        done: (err: any, secret?: string) => void,
      ) => {
        const { secrets } = this.getJwtAccessSecrets();
        const decoded = jwt.decode(rawJwtToken, { complete: true }) as jwt.Jwt | null;
        const kid =
          decoded && typeof decoded === 'object' ? (decoded.header as any)?.kid : undefined;

        if (kid && secrets[kid]) {
          (req as any).jwtAccessSecretVersionUsed = kid;
          return done(null, secrets[kid]);
        }

        // No/unknown kid: probe each secret until one verifies the token signature.
        const entries = Object.entries(secrets);
        if (entries.length === 0) {
          (req as any).jwtAccessSecretVersionUsed = null;
          return done(null, this.configService.get<string>('JWT_SECRET') || 'your-secret-key');
        }

        for (const [version, secret] of entries) {
          try {
            jwt.verify(rawJwtToken, secret);
            (req as any).jwtAccessSecretVersionUsed = version;
            return done(null, secret);
          } catch {
            // try next
          }
        }

        // Fall back to first secret so passport-jwt returns a consistent 401 on bad signature.
        (req as any).jwtAccessSecretVersionUsed = null;
        return done(null, entries[0][1]);
      },
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const roles = payload.roles || (payload.role ? [payload.role] : []);

    const { currentVersion, currentSecret } = this.getCurrentJwtAccessSecret();
    const token = this.extractBearerToken(req);
    const tokenKid = token ? this.getTokenKid(token) : null;
    const usedVersion = (req as any).jwtAccessSecretVersionUsed ?? tokenKid;
    const shouldReissue = !!currentVersion && !!usedVersion && usedVersion !== currentVersion;

    if (shouldReissue && (req as any)?.res) {
      const newAccessToken = await this.jwtService.signAsync(
        {
          sub: payload.sub,
          email: payload.email,
          role: roles[0],
          roles,
          sid: payload.sid,
        },
        {
          secret: currentSecret,
          expiresIn: parseInt(this.configService.get<string>('JWT_EXPIRES_IN') || '900', 10),
          header: { kid: currentVersion },
        },
      );
      (req as any).res.setHeader('x-access-token', newAccessToken);
    }

    return {
      userId: payload.sub,
      email: payload.email,
      roles,
      sessionId: payload.sid,
    };
  }

  private extractBearerToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header) return null;
    const [type, token] = header.split(' ');
    if (!token || type.toLowerCase() !== 'bearer') return null;
    return token;
  }

  private getTokenKid(token: string): string | null {
    const decoded = jwt.decode(token, { complete: true }) as jwt.Jwt | null;
    const kid = decoded && typeof decoded === 'object' ? (decoded.header as any)?.kid : undefined;
    return typeof kid === 'string' ? kid : null;
  }

  private getJwtAccessSecrets(): {
    currentVersion: string | null;
    secrets: Record<string, string>;
  } {
    const jwtSecretsRaw = this.configService.get<string>('JWT_SECRETS');
    const currentVersion = this.configService.get<string>('JWT_SECRET_CURRENT_VERSION') || null;

    if (!jwtSecretsRaw) {
      const secret = this.configService.get<string>('JWT_SECRET') || 'your-secret-key';
      return {
        currentVersion,
        secrets: currentVersion ? { [currentVersion]: secret } : { default: secret },
      };
    }

    return { currentVersion, secrets: this.parseJwtSecrets(jwtSecretsRaw) };
  }

  private getCurrentJwtAccessSecret(): { currentVersion: string | null; currentSecret: string } {
    const { currentVersion, secrets } = this.getJwtAccessSecrets();
    const currentSecret =
      (currentVersion && secrets[currentVersion]) || this.configService.get<string>('JWT_SECRET');
    return {
      currentVersion,
      currentSecret: currentSecret || Object.values(secrets)[0] || 'your-secret-key',
    };
  }

  private parseJwtSecrets(raw: string): Record<string, string> {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, string>;
      }
    } catch {
      // ignore
    }

    return raw
      .split(',')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((acc, pair) => {
        const idx = pair.indexOf(':');
        if (idx <= 0) return acc;
        const version = pair.slice(0, idx).trim();
        const secret = pair.slice(idx + 1).trim();
        if (!version || !secret) return acc;
        acc[version] = secret;
        return acc;
      }, {});
  }
}
