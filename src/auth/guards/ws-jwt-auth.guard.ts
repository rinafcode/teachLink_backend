import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const token =
      client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      client.disconnect(true);
      return false;
    }

    try {
      const payload = await this.verifyAccessToken(token);
      (client as any).user = payload; // attach user context
      return true;
    } catch {
      client.disconnect(true);
      return false;
    }
  }

  private async verifyAccessToken(token: string): Promise<any> {
    const { secrets } = this.getJwtAccessSecrets();
    const kid = this.getTokenKid(token);

    if (kid && secrets[kid]) {
      return this.jwtService.verifyAsync(token, { secret: secrets[kid] });
    }

    const secretList = Object.values(secrets);
    if (secretList.length === 0) {
      return this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
      });
    }

    let lastError: unknown;
    for (const secret of secretList) {
      try {
        return await this.jwtService.verifyAsync(token, { secret });
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError;
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
