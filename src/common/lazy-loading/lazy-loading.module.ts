import { Module, Global, DynamicModule } from '@nestjs/common';
import { LazyModuleLoader } from './lazy-module-loader.service';

/**
 * Registers the lazy Loading module.
 */
@Global()
@Module({
  providers: [LazyModuleLoader],
  exports: [LazyModuleLoader],
})
export class LazyLoadingModule {
  /**
   * Creates the root application module.
   * @returns The resulting dynamic module.
   */
  static forRoot(): DynamicModule {
    return {
      module: LazyLoadingModule,
      providers: [LazyModuleLoader],
      exports: [LazyModuleLoader],
      global: true,
    };
  }
}
