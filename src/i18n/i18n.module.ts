import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { I18nController } from './i18n.controller';
import { I18nWrapperService } from './i18n.service';
import { LocaleMiddleware } from './i18n.middleware';

@Module({
  imports: [],
  controllers: [I18nController],
  providers: [I18nWrapperService, LocaleMiddleware],
  exports: [I18nWrapperService],
})
export class I18nModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LocaleMiddleware).forRoutes('*');
  }
}
