import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';
import { DebuggingModule } from './debugging/debugging.module';

@Module({
  imports: [SearchModule, DebuggingModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {
  static async forRoot(): Promise<typeof AppModule> {
    return AppModule;
  }
}
