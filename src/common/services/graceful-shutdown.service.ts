import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ShutdownStateService } from './shutdown-state.service';

export interface ShutdownPhase {
  name: string;
  timeout: number;
  execute: () => Promise<void>;
}

export interface GracefulShutdownOptions {
  phases: ShutdownPhase[];
  globalTimeout: number;
  forceExitOnTimeout: boolean;
}

/**
 * Orchestrates graceful shutdown across all application components
 * Ensures proper cleanup of resources in the correct order
 */
@Injectable()
export class GracefulShutdownService implements OnModuleDestroy {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;
  private forceExitTimer: NodeJS.Timeout | null = null;
  
  private readonly shutdownPhases: ShutdownPhase[] = [];
  private readonly globalTimeout: number;
  private readonly forceExitOnTimeout: boolean;

  constructor(
    private readonly shutdownState: ShutdownStateService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.globalTimeout = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000', 10);
    this.forceExitOnTimeout = process.env.FORCE_EXIT_ON_TIMEOUT !== 'false';
  }

  /**
   * Register a shutdown phase to be executed during graceful shutdown
   */
  registerShutdownPhase(phase: ShutdownPhase): void {
    this.shutdownPhases.push(phase);
    this.logger.debug(`Registered shutdown phase: ${phase.name} (timeout: ${phase.timeout}ms)`);
  }

  /**
   * Start graceful shutdown process
   */
  async shutdown(signal?: string): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress, waiting for completion...');
      return this.shutdownPromise || Promise.resolve();
    }

    this.isShuttingDown = true;
    this.shutdownState.markShuttingDown();
    
    const signalMsg = signal ? ` (signal: ${signal})` : '';
    this.logger.log(`Starting graceful shutdown${signalMsg}...`);

    // Set global timeout
    if (this.forceExitOnTimeout) {
      this.forceExitTimer = setTimeout(() => {
        this.logger.error(`Graceful shutdown timed out after ${this.globalTimeout}ms. Forcing exit.`);
        process.exit(1);
      }, this.globalTimeout);
      this.forceExitTimer.unref();
    }

    this.shutdownPromise = this.executeShutdownPhases();
    
    try {
      await this.shutdownPromise;
      this.logger.log('Graceful shutdown completed successfully');
      
      if (this.forceExitTimer) {
        clearTimeout(this.forceExitTimer);
        this.forceExitTimer = null;
      }
    } catch (error) {
      this.logger.error('Error during graceful shutdown:', error);
      throw error;
    }
  }

  /**
   * Execute all registered shutdown phases in order
   */
  private async executeShutdownPhases(): Promise<void> {
    // Sort phases by priority (phases with shorter timeouts first, then by registration order)
    const sortedPhases = [...this.shutdownPhases].sort((a, b) => a.timeout - b.timeout);
    
    for (const phase of sortedPhases) {
      await this.executePhase(phase);
    }
  }

  /**
   * Execute a single shutdown phase with timeout
   */
  private async executePhase(phase: ShutdownPhase): Promise<void> {
    this.logger.log(`Executing shutdown phase: ${phase.name}`);
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Phase '${phase.name}' timed out after ${phase.timeout}ms`));
        }, phase.timeout);
      });

      await Promise.race([phase.execute(), timeoutPromise]);
      
      const duration = Date.now() - startTime;
      this.logger.log(`Shutdown phase '${phase.name}' completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Shutdown phase '${phase.name}' failed after ${duration}ms:`,
        error instanceof Error ? error.message : String(error)
      );
      
      // Continue with other phases even if one fails
      // This ensures we attempt to clean up as much as possible
    }
  }

  /**
   * Check if shutdown is in progress
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Get shutdown status information
   */
  getShutdownStatus(): {
    isShuttingDown: boolean;
    registeredPhases: number;
    globalTimeout: number;
  } {
    return {
      isShuttingDown: this.isShuttingDown,
      registeredPhases: this.shutdownPhases.length,
      globalTimeout: this.globalTimeout,
    };
  }

  /**
   * NestJS lifecycle hook - called when module is being destroyed
   */
  async onModuleDestroy(): Promise<void> {
    if (!this.isShuttingDown) {
      await this.shutdown('MODULE_DESTROY');
    }
  }
}