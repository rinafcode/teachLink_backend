import { Injectable, Logger, OnModuleInit, OnApplicationBootstrap } from '@nestjs/common';
export interface StartupMetrics {
    bootstrapStartTime: number;
    bootstrapEndTime: number;
    totalStartupTimeMs: number;
    moduleInitTimeMs: number;
    modulesLoaded: string[];
    modulesSkipped: string[];
    memoryUsage: NodeJS.MemoryUsage;
}
export interface ModuleLoadMetric {
    moduleName: string;
    startTime: number;
    endTime: number;
    durationMs: number;
    dependencies: string[];
}
@Injectable()
export class StartupLogger implements OnModuleInit, OnApplicationBootstrap {
    private readonly logger = new Logger(StartupLogger.name);
    private bootstrapStartTime: number = 0;
    private moduleInitStartTime: number = 0;
    private moduleMetrics: Map<string, ModuleLoadMetric> = new Map();
    private modulesLoaded: string[] = [];
    private modulesSkipped: string[] = [];
    constructor() {
        this.bootstrapStartTime = Date.now();
        this.moduleInitStartTime = this.bootstrapStartTime;
    }
    onModuleInit() {
        this.moduleInitStartTime = Date.now();
        this.logger.log('Module initialization started');
    }
    onApplicationBootstrap() {
        const metrics = this.generateMetrics();
        this.logStartupReport(metrics);
    }
    /**
     * Record a module being loaded
     */
    recordModuleLoaded(moduleName: string, startTime: number, dependencies: string[] = []): void {
        const endTime = Date.now();
        const durationMs = endTime - startTime;
        this.moduleMetrics.set(moduleName, {
            moduleName,
            startTime,
            endTime,
            durationMs,
            dependencies,
        });
        this.modulesLoaded.push(moduleName);
        this.logger.debug(`Module ${moduleName} loaded in ${durationMs}ms`);
    }
    /**
     * Record a module being skipped (feature flag disabled)
     */
    recordModuleSkipped(moduleName: string, reason: string): void {
        this.modulesSkipped.push(moduleName);
        this.logger.debug(`Module ${moduleName} skipped: ${reason}`);
    }
    /**
     * Get all recorded metrics
     */
    getMetrics(): StartupMetrics {
        return this.generateMetrics();
    }
    /**
     * Get module load metrics
     */
    getModuleMetrics(): ModuleLoadMetric[] {
        return Array.from(this.moduleMetrics.values());
    }
    /**
     * Get slowest loading modules
     */
    getSlowestModules(limit: number = 5): ModuleLoadMetric[] {
        return this.getModuleMetrics()
            .sort((a, b) => b.durationMs - a.durationMs)
            .slice(0, limit);
    }
    /**
     * Get total startup time
     */
    getTotalStartupTime(): number {
        return Date.now() - this.bootstrapStartTime;
    }
    /**
     * Generate a complete startup report
     */
    private generateMetrics(): StartupMetrics {
        const now = Date.now();
        return {
            bootstrapStartTime: this.bootstrapStartTime,
            bootstrapEndTime: now,
            totalStartupTimeMs: now - this.bootstrapStartTime,
            moduleInitTimeMs: now - this.moduleInitStartTime,
            modulesLoaded: this.modulesLoaded,
            modulesSkipped: this.modulesSkipped,
            memoryUsage: process.memoryUsage(),
        };
    }
    /**
     * Log startup report
     */
    private logStartupReport(metrics: StartupMetrics): void {
        const totalModules = metrics.modulesLoaded.length + metrics.modulesSkipped.length;
        const loadedCount = metrics.modulesLoaded.length;
        const skippedCount = metrics.modulesSkipped.length;
        this.logger.log('========================================');
        this.logger.log('       STARTUP REPORT');
        this.logger.log('========================================');
        this.logger.log(`Total Startup Time: ${metrics.totalStartupTimeMs}ms`);
        this.logger.log(`Module Init Time: ${metrics.moduleInitTimeMs}ms`);
        this.logger.log(`Modules Loaded: ${loadedCount}/${totalModules}`);
        this.logger.log(`Modules Skipped: ${skippedCount}/${totalModules}`);
        if (skippedCount > 0) {
            this.logger.log(`Skipped Modules: ${metrics.modulesSkipped.join(', ')}`);
        }
        // Memory usage
        const memoryMB = Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024);
        this.logger.log(`Memory Usage: ${memoryMB}MB`);
        // Slowest modules
        const slowest = this.getSlowestModules(3);
        if (slowest.length > 0) {
            this.logger.log('Slowest Modules:');
            slowest.forEach((m) => {
                this.logger.log(`  - ${m.moduleName}: ${m.durationMs}ms`);
            });
        }
        this.logger.log('========================================');
        // Performance warning if startup is slow
        if (metrics.totalStartupTimeMs > 10000) {
            this.logger.warn('Startup time exceeds 10 seconds - consider optimizing module loading');
        }
    }
    /**
     * Generate JSON report for external monitoring
     */
    generateJSONReport(): Record<string, unknown> {
        const metrics = this.generateMetrics();
        return {
            timestamp: new Date().toISOString(),
            startup: {
                totalTimeMs: metrics.totalStartupTimeMs,
                moduleInitTimeMs: metrics.moduleInitTimeMs,
            },
            modules: {
                total: metrics.modulesLoaded.length + metrics.modulesSkipped.length,
                loaded: metrics.modulesLoaded.length,
                skipped: metrics.modulesSkipped.length,
                loadedList: metrics.modulesLoaded,
                skippedList: metrics.modulesSkipped,
            },
            memory: {
                heapUsed: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(metrics.memoryUsage.heapTotal / 1024 / 1024),
                rss: Math.round(metrics.memoryUsage.rss / 1024 / 1024),
                external: Math.round(metrics.memoryUsage.external / 1024 / 1024),
            },
            moduleMetrics: this.getModuleMetrics().map((m) => ({
                name: m.moduleName,
                loadTimeMs: m.durationMs,
                dependencies: m.dependencies,
            })),
        };
    }
}
