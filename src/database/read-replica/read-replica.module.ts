import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReadReplicaRoutingService } from './read-replica-routing.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  providers: [ReadReplicaRoutingService],
  exports: [ReadReplicaRoutingService],
})
export class ReadReplicaModule {}
