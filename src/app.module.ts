import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';
import { ValidationController } from './diagnostics/validation.controller';

@Module({
  imports: [
    SearchModule,
  ],
  controllers: [AppController, ValidationController],
  providers: [],
})
export class AppModule {}
