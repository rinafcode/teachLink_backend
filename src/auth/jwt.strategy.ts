import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { UserRole } from '../users/entities/user.entity';
interface JwtPayload {
    sub: string;
    email: string;
    role: UserRole;
    sid: string;
}
interface ValidatedUser {
    sub: string;
    email: string;
    role: UserRole;
    sid: string;
}
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly configService: ConfigService, private readonly jwtService: JwtService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            passReqToCallback: true,
            secretOrKeyProvider: (req: Request, rawJwtToken: string, done: (err: unknown, secret?: string) => void) => {
                const { secrets } = this.getJwtAccessSecrets();
                const decoded = jwt.decode(rawJwtToken, { complete: true }) as jwt.Jwt | null;
                const kid = decoded && typeof decoded === 'object' ? (decoded.header as unknown)?.kid : undefined;
                if (kid && secrets[kid]) {
                    (req as unknown).jwtAccessSecretVersionUsed = kid;
                    return done(null, secrets[kid]);
                }
                const entries = Object.entries(secrets);
                if (entries.length === 0) {
                    (req as unknown).jwtAccessSecretVersionUsed = null;
                    return done(null, this.configService.get<string>('JWT_SECRET') || 'your-secret-key');
                }
                for (const [version, secret] of entries) {
                    try {
                        jwt.verify(rawJwtToken, secret);
                        (req as unknown).jwtAccessSecretVersionUsed = version;
                        return done(null, secret);
                    }
                    catch {
                        // try next
                    }
                }
                (req as unknown).jwtAccessSecretVersionUsed = null;
                return done(null, entries[0][1]);
            },
        });
    }
    async validate(req: Request, payload: JwtPayload): Promise<ValidatedUser> {
        const { currentVersion, currentSecret } = this.getCurrentJwtAccessSecret();
        const token = this.extractBearerToken(req);
        const tokenKid = token ? this.getTokenKid(token) : null;
        const usedVersion = (req as unknown).jwtAccessSecretVersionUsed ?? tokenKid;
        const shouldReissue = !!currentVersion && !!usedVersion && usedVersion !== currentVersion;
        if (shouldReissue && (req as unknown)?.res) {
            const newAccessToken = await this.jwtService.signAsync({
                sub: payload.sub,
                email: payload.email,
                role: payload.role,
                sid: payload.sid,
            }, {
                secret: currentSecret,
                expiresIn: parseInt(this.configService.get<string>('JWT_EXPIRES_IN') || '900', 10),
                header: { kid: currentVersion },
            });
            (req as unknown).res.setHeader('x-access-token', newAccessToken);
        }
        return { sub: payload.sub, email: payload.email, role: payload.role, sid: payload.sid };
    }
    private extractBearerToken(req: Request): string | null {
        const header = req.headers.authorization;
        if (!header)
            return null;
        const [type, token] = header.split(' ');
        if (!token || type.toLowerCase() !== 'bearer')
            return null;
        return token;
    }
    private getTokenKid(token: string): string | null {
        const decoded = jwt.decode(token, { complete: true }) as jwt.Jwt | null;
        const kid = decoded && typeof decoded === 'object' ? (decoded.header as unknown)?.kid : undefined;
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
    private getCurrentJwtAccessSecret(): {
        currentVersion: string | null;
        currentSecret: string;
    } {
        const { currentVersion, secrets } = this.getJwtAccessSecrets();
        const currentSecret = (currentVersion && secrets[currentVersion]) || this.configService.get<string>('JWT_SECRET');
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
        }
        catch {
            // ignore
        }
        return raw
            .split(',')
            .map((pair) => pair.trim())
            .filter(Boolean)
            .reduce<Record<string, string>>((acc, pair) => {
            const idx = pair.indexOf(':');
            if (idx <= 0)
                return acc;
            const version = pair.slice(0, idx).trim();
            const secret = pair.slice(idx + 1).trim();
            if (!version || !secret)
                return acc;
            acc[version] = secret;
            return acc;
        }, {});
    }
}
