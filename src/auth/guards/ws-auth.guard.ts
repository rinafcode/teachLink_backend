import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';

export interface JwtPayload {
  sub: string | number;
  email?: string;
  [key: string]: unknown;
}

export type AuthenticatedSocket = Socket & {
  data: { user: JwtPayload };
};

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const token: unknown = client.handshake?.auth?.token;

    if (!token || typeof token !== 'string') {
      this.logger.warn(`Connection ${client.id} rejected — no token provided`);
      client.disconnect(true);
      throw new WsException('Unauthorized: missing token');
    }

    try {
      const secret = this.config.getOrThrow<string>('JWT_SECRET');
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });
      // Attach verified identity to socket for downstream handlers
      (client as AuthenticatedSocket).data = { user: payload };
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'token verification failed';
      this.logger.warn(`Connection ${client.id} rejected — ${message}`);
      client.disconnect(true);
      throw new WsException(`Unauthorized: ${message}`);
    }
  }
}