import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

/* Core */
import { User } from './users/entities/user.entity';

/* Tenancy */
import { TenancyModule } from './tenancy/tenancy.module';
import { Tenant } from './tenancy/entities/tenant.entity';
import { TenantConfig } from './tenancy/entities/tenant-config.entity';
import { TenantBilling } from './tenancy/entities/tenant-billing.entity';
import { TenantCustomization } from './tenancy/entities/tenant-customization.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RateLimitingModule } from './rate-limiting/rate-limiting.module';
import { SecurityModule } from './security/security.module';
import { GamificationModule } from './gamification/gamification.module';
import { PointTransaction } from './gamification/entities/point-transaction.entity';
import { UserProgress } from './gamification/entities/user-progress.entity';
import { Badge } from './gamification/entities/badge.entity';
import { UserBadge } from './gamification/entities/user-badge.entity';
import { Challenge } from './gamification/entities/challenge.entity';
import { UserChallenge } from './gamification/entities/user-challenge.entity';
import { MonitoringInterceptor } from './monitoring/monitoring.interceptor';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'teachlink',
      synchronize: true, // ⚠️ disable in production
      entities: [
        User,
        Tenant,
        TenantConfig,
        TenantBilling,
        TenantCustomization,
        PointTransaction,
        UserProgress,
        Badge,
        UserBadge,
        Challenge,
        UserChallenge,
      ],
    }),
    RateLimitingModule,
    SecurityModule,
    AuthModule,
    UsersModule,
    TenancyModule,
    GamificationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MonitoringInterceptor,
    },
  ],
})
export class AppModule {}
