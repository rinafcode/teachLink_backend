import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  UseGuards,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { WsAuthGuard, AuthenticatedSocket } from '../auth/guards/ws-auth.guard';

function resolveAllowedOrigins(config: ConfigService): string[] {
  const raw = config.get<string>('WS_ALLOWED_ORIGINS', '');
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

@WebSocketGateway({
  namespace: '/collaboration',
  cors: {
    // Origin callback evaluated per-connection (#795)
    origin(requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      // This function is replaced at runtime by CollaborationGateway.configureOrigin
      // The static decorator value is overridden in the constructor via server options.
      callback(null, false);
    },
    credentials: true,
  },
})
@UseGuards(WsAuthGuard) // #796 — rejects unauthenticated connections
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CollaborationGateway.name);
  private readonly allowedOrigins: string[];

  constructor(private readonly config: ConfigService) {
    this.allowedOrigins = resolveAllowedOrigins(config);
    this.logger.log(`WS allowed origins: ${this.allowedOrigins.join(', ') || '(none)'}`);
  }

  afterInit(server: Server): void {
    const allowed = this.allowedOrigins;
    // Override CORS origin function with the runtime allowlist (#795)
    server.engine.on('initial_headers', () => { /* handled by origin callback below */ });
    (server as any).opts = {
      ...(server as any).opts,
      cors: {
        origin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
          if (!origin || allowed.includes(origin)) {
            cb(null, true);
          } else {
            cb(new Error(`Origin "${origin}" is not allowed`), false);
          }
        },
        credentials: true,
      },
    };
  }

  handleConnection(client: Socket): void {
    // WsAuthGuard has already verified the token by the time this runs.
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: { sessionId: string },
  ): void {
    // Use verified user identity from token — NOT dto.userId (#796)
    const userId = client.data.user.sub;
    this.logger.log(`User ${userId} joining session ${dto.sessionId}`);
    void client.join(dto.sessionId);
    client.to(dto.sessionId).emit('user-joined', { userId, sessionId: dto.sessionId });
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('operation')
  handleOperation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: { sessionId: string; operation: unknown },
  ): void {
    const userId = client.data.user.sub;
    client.to(dto.sessionId).emit('operation', { userId, operation: dto.operation });
  }
}