import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { BackpressureService } from './backpressure.service';

@ApiTags('queue-backpressure')
@Controller('queues/backpressure')
export class BackpressureController {
  constructor(private readonly backpressureService: BackpressureService) {}

  @Get()
  @ApiOperation({ summary: 'Get backpressure snapshots for all queues' })
  getAllSnapshots() {
    return this.backpressureService.getAllSnapshots();
  }

  @Get(':queue')
  @ApiParam({ name: 'queue', description: 'Queue name' })
  @ApiOperation({ summary: 'Get backpressure snapshot for a specific queue' })
  getSnapshot(@Param('queue') queue: string) {
    return this.backpressureService.getSnapshot(queue) ?? { message: `No data for queue "${queue}"` };
  }
}