import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';
import { RoutingModule } from './routing/routing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    SearchModule,
    RoutingModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
