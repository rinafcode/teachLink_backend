import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';
import { DebuggingModule } from './debugging/debugging.module';
import { DataPipelineModule } from './data-pipeline/data-pipeline.module';

@Module({
  imports: [
    SearchModule,
    DebuggingModule,
    DataPipelineModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
