import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
    }),
  ],
  exports: [CacheModule],
})
export class CachingModule {}