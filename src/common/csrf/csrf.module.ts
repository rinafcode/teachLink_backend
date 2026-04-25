import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { CsrfMiddleware } from '../middleware/csrf.middleware';
import { CsrfService } from './csrf.service';
import { CsrfController } from './csrf.controller';
@Module({
    providers: [CsrfService],
    controllers: [CsrfController],
    exports: [CsrfService],
})
export class CsrfModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(CsrfMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
    }
}
