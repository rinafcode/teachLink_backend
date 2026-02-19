import { Module } from '@nestjs/common';
import { ETLPipelineService } from './etl/etl-pipeline.service';
import { DimensionalModelingService } from './modeling/dimensional-modeling.service';
import { DataQualityService } from './quality/data-quality.service';
import { DataLineageService } from './lineage/data-lineage.service';
import { IncrementalLoaderService } from './loading/incremental-loader.service';
import { DataWarehouseController } from './data-warehouse.controller';

@Module({
  imports: [],
  controllers: [DataWarehouseController],
  providers: [
    ETLPipelineService,
    DimensionalModelingService,
    DataQualityService,
    DataLineageService,
    IncrementalLoaderService,
  ],
  exports: [
    ETLPipelineService,
    DimensionalModelingService,
    DataQualityService,
    DataLineageService,
    IncrementalLoaderService,
  ],
})
export class DataWarehouseModule {}