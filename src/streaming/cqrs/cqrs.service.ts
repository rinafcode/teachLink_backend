import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

/**
 * Command interface for CQRS pattern
 */
export interface Command<T = any> {
  type: string;
  payload: T;
  metadata?: Record<string, any>;
}

/**
 * Query interface for CQRS pattern
 */
export interface Query<T = any> {
  type: string;
  parameters: T;
  metadata?: Record<string, any>;
}

/**
 * Command handler type
 */
export type CommandHandler<T = any, R = any> = (command: Command<T>) => Promise<R>;

/**
 * Query handler type
 */
export type QueryHandler<P = any, R = any> = (query: Query<P>) => Promise<R>;

/**
 * Service for implementing CQRS pattern
 */
@Injectable()
export class CQRSService {
  private readonly logger = new Logger(CQRSService.name);
  private readonly commandBus = new Subject<Command>();
  private readonly queryBus = new Subject<Query>();
  private readonly commandHandlers = new Map<string, CommandHandler>();
  private readonly queryHandlers = new Map<string, QueryHandler>();
  
  /**
   * Register a command handler
   * @param commandType The type of command to handle
   * @param handler The handler function
   */
  registerCommandHandler<T = any, R = any>(
    commandType: string,
    handler: CommandHandler<T, R>,
  ): void {
    this.commandHandlers.set(commandType, handler);
    this.logger.log(`Registered command handler for: ${commandType}`);
  }

  /**
   * Register a query handler
   * @param queryType The type of query to handle
   * @param handler The handler function
   */
  registerQueryHandler<P = any, R = any>(
    queryType: string,
    handler: QueryHandler<P, R>,
  ): void {
    this.queryHandlers.set(queryType, handler);
    this.logger.log(`Registered query handler for: ${queryType}`);
  }

  /**
   * Execute a command
   * @param command The command to execute
   */
  async executeCommand<T = any, R = any>(command: Command<T>): Promise<R> {
    this.logger.debug(`Executing command: ${command.type}`);
    const handler = this.commandHandlers.get(command.type) as CommandHandler<T, R>;
    
    if (!handler) {
      throw new Error(`No handler registered for command type: ${command.type}`);
    }
    
    this.commandBus.next(command);
    return handler(command);
  }

  /**
   * Execute a query
   * @param query The query to execute
   */
  async executeQuery<P = any, R = any>(query: Query<P>): Promise<R> {
    this.logger.debug(`Executing query: ${query.type}`);
    const handler = this.queryHandlers.get(query.type) as QueryHandler<P, R>;
    
    if (!handler) {
      throw new Error(`No handler registered for query type: ${query.type}`);
    }
    
    this.queryBus.next(query);
    return handler(query);
  }

  /**
   * Get an observable of all commands
   */
  observeCommands(): Observable<Command> {
    return this.commandBus.asObservable();
  }

  /**
   * Get an observable of specific command types
   * @param commandType The command type to observe
   */
  observeCommandType(commandType: string): Observable<Command> {
    return this.commandBus.pipe(
      filter(command => command.type === commandType)
    );
  }

  /**
   * Get an observable of all queries
   */
  observeQueries(): Observable<Query> {
    return this.queryBus.asObservable();
  }

  /**
   * Get an observable of specific query types
   * @param queryType The query type to observe
   */
  observeQueryType(queryType: string): Observable<Query> {
    return this.queryBus.pipe(
      filter(query => query.type === queryType)
    );
  }
}