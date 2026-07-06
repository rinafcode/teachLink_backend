import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppLoggerService } from './logger.service';
import { HttpLoggingInterceptor } from './http-logging.interceptor';

@Global()
@Module({
  providers: [AppLoggerService, { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor }],
  exports: [AppLoggerService],
})
export class LoggingModule {}
