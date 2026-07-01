import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { OtCrdtService } from './ot-crdt.service';
import { PresenceService } from './presence.service';
import { ChangeHistoryService } from './change-history.service';
import { CollaborationGateway } from './collaboration.gateway';
import { WsPayloadSizeGuardService } from './guards/ws-payload-size-guard.service';
import { WsJwtAuthGuard } from './guards/ws-jwt-auth.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-jwt-secret',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any },
    }),
  ],
  providers: [
    OtCrdtService,
    PresenceService,
    ChangeHistoryService,
    CollaborationGateway,
    WsPayloadSizeGuardService,
    WsJwtAuthGuard,
  ],
  exports: [OtCrdtService, PresenceService, ChangeHistoryService],
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