import { Module, Global, DynamicModule } from '@nestjs/common';
import { LazyModuleLoader } from './lazy-module-loader.service';

@Global()
@Module({
  providers: [LazyModuleLoader],
  exports: [LazyModuleLoader],
})
export class LazyLoadingModule {
  static forRoot(): DynamicModule {
    return {
      module: LazyLoadingModule,
      providers: [LazyModuleLoader],
      exports: [LazyModuleLoader],
      global: true,
    };
  }
}
