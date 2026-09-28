import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PoolMonitorService } from './pool/pool-monitor.service';
import { PoolLeakDetectorService } from './pool/pool-leak-detector.service';

/**
 * DatabasePoolModule registers connection-pool monitoring and leak-detection
 * services. Import this module wherever pool observability is needed (e.g.
 * AppModule or the existing DatabaseModule).
 */
@Module({
  imports: [TypeOrmModule.forFeature([])],
  providers: [PoolMonitorService, PoolLeakDetectorService],
  exports: [PoolMonitorService, PoolLeakDetectorService],
})
export class DatabasePoolModule {}
