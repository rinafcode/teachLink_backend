import { Module } from '@nestjs/common';
import { TimeoutConfigService } from './timeout-config.service';
import { TimeoutController } from './timeout.controller';
import { TimeoutExampleController } from '../examples/timeout-example.controller';
@Module({
    providers: [TimeoutConfigService],
    controllers: [TimeoutController, TimeoutExampleController],
    exports: [TimeoutConfigService],
})
export class TimeoutModule {
}
