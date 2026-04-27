import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SessionModule } from '../session/session.module';
import { TransactionService } from '../common/database/transaction.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PasswordPolicyService } from './services/password-policy.service';

function parseJwtSecrets(raw: string): Record<string, string> {
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

function getCurrentJwtAccessSecret(configService: ConfigService): string {
  const jwtSecretsRaw = configService.get<string>('JWT_SECRETS');
  if (!jwtSecretsRaw) return configService.get<string>('JWT_SECRET') ?? 'your-secret-key';

  const currentVersion = configService.get<string>('JWT_SECRET_CURRENT_VERSION');
  const secrets = parseJwtSecrets(jwtSecretsRaw);
  const current =
    (currentVersion && secrets[currentVersion]) || configService.get<string>('JWT_SECRET');
  return current || Object.values(secrets)[0] || 'your-secret-key';
}

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    SessionModule,
    NotificationsModule,
    AuditLogModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (
        configService: ConfigService,
      ): Promise<{ secret: string; signOptions: { expiresIn: number } }> => ({
        secret: getCurrentJwtAccessSecret(configService),
        signOptions: {
          expiresIn: parseInt(configService.get<string>('JWT_EXPIRES_IN') ?? '900', 10), // Convert to seconds (number)
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TransactionService, PasswordPolicyService],
  exports: [AuthService],
})
export class AuthModule {}
