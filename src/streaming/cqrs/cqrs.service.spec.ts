import { Test, TestingModule } from '@nestjs/testing';
import { CQRSService, Command, Query } from './cqrs.service';
import { Observable } from 'rxjs';
import { take, toArray } from 'rxjs/operators';

describe('CQRSService', () => {
  let service: CQRSService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CQRSService],
    }).compile();

    service = module.get<CQRSService>(CQRSService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerCommandHandler', () => {
    it('should register a command handler', async () => {
      // Define a test command type
      const commandType = 'CreateUser';
      
      // Define a test command handler
      const handler = jest.fn().mockResolvedValue({ success: true });
      
      // Register the command handler
      service.registerCommandHandler(commandType, handler);
      
      // Create a test command
      const command: Command = {
        type: commandType,
        payload: { name: 'John Doe', email: 'john@example.com' },
        metadata: { userId: 'admin-1' },
      };
      
      // Execute the command
      const result = await service.executeCommand(command);
      
      // Verify the handler was called with the command
      expect(handler).toHaveBeenCalledWith(command);
      expect(result).toEqual({ success: true });
    });

    it('should throw an error when executing a command with no registered handler', async () => {
      // Create a test command with no registered handler
      const command: Command = {
        type: 'UnknownCommand',
        payload: { data: 'test' },
        metadata: { userId: 'admin-1' },
      };
      
      // Execute the command and expect it to throw
      await expect(service.executeCommand(command)).rejects.toThrow(
        'No handler registered for command type: UnknownCommand'
      );
    });
  });

  describe('registerQueryHandler', () => {
    it('should register a query handler', async () => {
      // Define a test query type
      const queryType = 'GetUserById';
      
      // Define a test query handler
      const handler = jest.fn().mockResolvedValue({ id: '123', name: 'John Doe' });
      
      // Register the query handler
      service.registerQueryHandler(queryType, handler);
      
      // Create a test query
      const query: Query = {
        type: queryType,
        payload: { id: '123' },
        metadata: { userId: 'admin-1' },
      };
      
      // Execute the query
      const result = await service.executeQuery(query);
      
      // Verify the handler was called with the query
      expect(handler).toHaveBeenCalledWith(query);
      expect(result).toEqual({ id: '123', name: 'John Doe' });
    });

    it('should throw an error when executing a query with no registered handler', async () => {
      // Create a test query with no registered handler
      const query: Query = {
        type: 'UnknownQuery',
        payload: { id: '123' },
        metadata: { userId: 'admin-1' },
      };
      
      // Execute the query and expect it to throw
      await expect(service.executeQuery(query)).rejects.toThrow(
        'No handler registered for query type: UnknownQuery'
      );
    });
  });

  describe('observeCommands', () => {
    it('should allow subscription to commands by type', (done) => {
      // Define test commands
      const command1: Command = {
        type: 'CreateUser',
        payload: { name: 'John Doe' },
        metadata: { userId: 'admin-1' },
      };
      
      const command2: Command = {
        type: 'UpdateUser',
        payload: { id: '123', name: 'John Updated' },
        metadata: { userId: 'admin-1' },
      };
      
      // Subscribe to CreateUser commands
      service.observeCommands('CreateUser')
        .pipe(take(1))
        .subscribe(command => {
          expect(command.type).toBe('CreateUser');
          expect(command.payload.name).toBe('John Doe');
          done();
        });
      
      // Execute commands
      service.executeCommand(command1).catch(() => {});
      service.executeCommand(command2).catch(() => {});
    });

    it('should allow subscription to all commands when no type is specified', (done) => {
      // Define test commands
      const command1: Command = {
        type: 'CreateUser',
        payload: { name: 'John Doe' },
        metadata: { userId: 'admin-1' },
      };
      
      const command2: Command = {
        type: 'UpdateUser',
        payload: { id: '123', name: 'John Updated' },
        metadata: { userId: 'admin-1' },
      };
      
      // Register handlers to prevent errors
      service.registerCommandHandler('CreateUser', () => Promise.resolve({}));
      service.registerCommandHandler('UpdateUser', () => Promise.resolve({}));
      
      // Subscribe to all commands
      service.observeCommands()
        .pipe(take(2), toArray())
        .subscribe(commands => {
          expect(commands).toHaveLength(2);
          expect(commands[0].type).toBe('CreateUser');
          expect(commands[1].type).toBe('UpdateUser');
          done();
        });
      
      // Execute commands
      service.executeCommand(command1);
      service.executeCommand(command2);
    });
  });

  describe('observeQueries', () => {
    it('should allow subscription to queries by type', (done) => {
      // Define test queries
      const query1: Query = {
        type: 'GetUserById',
        payload: { id: '123' },
        metadata: { userId: 'admin-1' },
      };
      
      const query2: Query = {
        type: 'GetAllUsers',
        payload: {},
        metadata: { userId: 'admin-1' },
      };
      
      // Subscribe to GetUserById queries
      service.observeQueries('GetUserById')
        .pipe(take(1))
        .subscribe(query => {
          expect(query.type).toBe('GetUserById');
          expect(query.payload.id).toBe('123');
          done();
        });
      
      // Execute queries
      service.executeQuery(query1).catch(() => {});
      service.executeQuery(query2).catch(() => {});
    });

    it('should allow subscription to all queries when no type is specified', (done) => {
      // Define test queries
      const query1: Query = {
        type: 'GetUserById',
        payload: { id: '123' },
        metadata: { userId: 'admin-1' },
      };
      
      const query2: Query = {
        type: 'GetAllUsers',
        payload: {},
        metadata: { userId: 'admin-1' },
      };
      
      // Register handlers to prevent errors
      service.registerQueryHandler('GetUserById', () => Promise.resolve({}));
      service.registerQueryHandler('GetAllUsers', () => Promise.resolve({}));
      
      // Subscribe to all queries
      service.observeQueries()
        .pipe(take(2), toArray())
        .subscribe(queries => {
          expect(queries).toHaveLength(2);
          expect(queries[0].type).toBe('GetUserById');
          expect(queries[1].type).toBe('GetAllUsers');
          done();
        });
      
      // Execute queries
      service.executeQuery(query1);
      service.executeQuery(query2);
    });
  });
});