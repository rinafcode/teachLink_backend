import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { calculateReconnectDelay } from '../src/common/utils/websocket.utils';

describe('WebSocket Reconnection (e2e)', () => {
  let app: INestApplication;
  let port: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0);
    const server = app.getHttpServer();
    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 3000;
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 30000);

  function connectClient(userId: string, lastSeq = 0): Socket {
    return io(`http://127.0.0.1:${port}/messages`, {
      query: { userId, lastSeq: String(lastSeq) },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
  }

  it('should connect and receive connected event', (done) => {
    const socket = connectClient('e2e-user-1');
    socket.on('connect', () => {
      socket.on('connected', (payload) => {
        expect(payload.userId).toBe('e2e-user-1');
        expect(payload.reconnectDelayMs).toBeGreaterThan(0);
        socket.disconnect();
        done();
      });
    });
    socket.on('connect_error', (err) => done.fail(err));
  }, 15000);

  it('should respond to ping with pong', (done) => {
    const socket = connectClient('e2e-user-2');
    socket.on('connect', () => {
      socket.emit('ping');
      socket.on('pong', () => {
        socket.disconnect();
        done();
      });
    });
  }, 15000);

  it('should use exponential backoff utility', () => {
    expect(calculateReconnectDelay(0)).toBe(1000);
    expect(calculateReconnectDelay(3)).toBe(8000);
    expect(calculateReconnectDelay(20)).toBeLessThanOrEqual(30000);
  });

  it('should reconnect with lastSeq after disconnect', (done) => {
    const userId = 'e2e-user-reconnect';
    const first = connectClient(userId, 0);
    first.on('connect', () => {
      first.disconnect();
      const second = connectClient(userId, 0);
      second.on('connected', () => {
        second.disconnect();
        done();
      });
    });
  }, 20000);
});
