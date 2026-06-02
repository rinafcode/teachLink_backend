import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DbConnectionHealthController } from './db-connection-health.controller';
import { DbConnectionHealthService } from './db-connection-health.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [DbConnectionHealthController],
  providers: [DbConnectionHealthService],
  exports: [DbConnectionHealthService],
})
export class DbConnectionHealthModule {}