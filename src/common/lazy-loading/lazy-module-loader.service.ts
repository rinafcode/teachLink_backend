import { Injectable, Logger, DynamicModule } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
export interface LazyModuleOptions {
    moduleName: string;
    featureFlag?: string;
    dependencies?: string[];
}
export interface ModuleLoadResult {
    moduleName: string;
    loadedAt: Date;
    loadTimeMs: number;
    success: boolean;
    error?: Error;
}
@Injectable()
export class LazyModuleLoader {
    private readonly logger = new Logger(LazyModuleLoader.name);
    private loadedModules = new Map<string, Promise<DynamicModule>>();
    private moduleLoadResults = new Map<string, ModuleLoadResult>();
    private moduleRegistry = new Map<string, () => Promise<DynamicModule>>();
    constructor(private readonly moduleRef: ModuleRef) { }
    /**
     * Register a lazy-loadable module
     */
    register(moduleName: string, factory: () => Promise<DynamicModule>): void {
        if (this.moduleRegistry.has(moduleName)) {
            this.logger.warn(`Module ${moduleName} is already registered`);
            return;
        }
        this.moduleRegistry.set(moduleName, factory);
        this.logger.debug(`Registered lazy module: ${moduleName}`);
    }
    /**
     * Load a module on-demand
     */
    async load(moduleName: string): Promise<DynamicModule | null> {
        // Check if already loaded
        if (this.loadedModules.has(moduleName)) {
            this.logger.debug(`Module ${moduleName} is already loaded`);
            const loadedModule = this.loadedModules.get(moduleName);
            if (loadedModule) {
                return loadedModule;
            }
        }
        // Check if registered
        const factory = this.moduleRegistry.get(moduleName);
        if (!factory) {
            this.logger.error(`Module ${moduleName} is not registered for lazy loading`);
            return null;
        }
        // Load the module
        const startTime = Date.now();
        this.logger.log(`Loading module: ${moduleName}...`);
        const loadPromise = this.loadModuleInternal(moduleName, factory, startTime);
        this.loadedModules.set(moduleName, loadPromise);
        return loadPromise;
    }
    /**
     * Load multiple modules
     */
    async loadMany(moduleNames: string[]): Promise<DynamicModule[]> {
        const results = await Promise.all(moduleNames.map((name) => this.load(name)));
        return results.filter((m): m is DynamicModule => m !== null);
    }
    /**
     * Check if a module is loaded
     */
    isLoaded(moduleName: string): boolean {
        return this.loadedModules.has(moduleName);
    }
    /**
     * Check if a module is registered
     */
    isRegistered(moduleName: string): boolean {
        return this.moduleRegistry.has(moduleName);
    }
    /**
     * Get list of loaded module names
     */
    getLoadedModules(): string[] {
        return Array.from(this.loadedModules.keys());
    }
    /**
     * Get list of registered module names
     */
    getRegisteredModules(): string[] {
        return Array.from(this.moduleRegistry.keys());
    }
    /**
     * Get load result for a module
     */
    getLoadResult(moduleName: string): ModuleLoadResult | undefined {
        return this.moduleLoadResults.get(moduleName);
    }
    /**
     * Get all load results
     */
    getAllLoadResults(): ModuleLoadResult[] {
        return Array.from(this.moduleLoadResults.values());
    }
    /**
     * Get total load time for all loaded modules
     */
    getTotalLoadTime(): number {
        let total = 0;
        for (const result of this.moduleLoadResults.values()) {
            if (result.success) {
                total += result.loadTimeMs;
            }
        }
        return total;
    }
    /**
     * Unload a module (for testing/memory management)
     */
    async unload(moduleName: string): Promise<boolean> {
        if (!this.loadedModules.has(moduleName)) {
            return false;
        }
        this.loadedModules.delete(moduleName);
        this.moduleLoadResults.delete(moduleName);
        this.logger.log(`Unloaded module: ${moduleName}`);
        return true;
    }
    /**
     * Preload modules that are likely to be needed
     */
    async preload(moduleNames: string[]): Promise<void> {
        this.logger.log(`Preloading ${moduleNames.length} modules...`);
        const startTime = Date.now();
        await this.loadMany(moduleNames);
        const duration = Date.now() - startTime;
        this.logger.log(`Preloaded ${moduleNames.length} modules in ${duration}ms`);
    }
    /**
     * Generate a report of all module loading activity
     */
    generateReport(): {
        registered: number;
        loaded: number;
        totalLoadTime: number;
        averageLoadTime: number;
        modules: ModuleLoadResult[];
    } {
        const results = this.getAllLoadResults();
        const successfulLoads = results.filter((r) => r.success);
        const totalLoadTime = this.getTotalLoadTime();
        return {
            registered: this.moduleRegistry.size,
            loaded: this.loadedModules.size,
            totalLoadTime,
            averageLoadTime: successfulLoads.length > 0 ? totalLoadTime / successfulLoads.length : 0,
            modules: results,
        };
    }
    private async loadModuleInternal(moduleName: string, factory: () => Promise<DynamicModule>, startTime: number): Promise<DynamicModule> {
        try {
            const module = await factory();
            const loadTimeMs = Date.now() - startTime;
            const result: ModuleLoadResult = {
                moduleName,
                loadedAt: new Date(),
                loadTimeMs,
                success: true,
            };
            this.moduleLoadResults.set(moduleName, result);
            this.logger.log(`Module ${moduleName} loaded in ${loadTimeMs}ms`);
            return module;
        }
        catch (error) {
            const loadTimeMs = Date.now() - startTime;
            const result: ModuleLoadResult = {
                moduleName,
                loadedAt: new Date(),
                loadTimeMs,
                success: false,
                error: error as Error,
            };
            this.moduleLoadResults.set(moduleName, result);
            this.logger.error(`Failed to load module ${moduleName} after ${loadTimeMs}ms`, (error as Error).message);
            throw error;
        }
    }
}
