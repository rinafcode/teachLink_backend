import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CorrelationIdHttpInterceptor } from './correlation-id-http.interceptor';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

@Global()
@Module({
  imports: [HttpModule],
  providers: [CorrelationIdMiddleware, CorrelationIdHttpInterceptor],
  exports: [CorrelationIdMiddleware, HttpModule],
})
export class CorrelationIdModule {}
