import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    SearchModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
