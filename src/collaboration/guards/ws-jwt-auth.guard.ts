import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * Guards WebSocket connections by validating a JWT supplied in the
 * handshake auth object or as a query parameter.
 */
@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtAuthGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const token =
      (client.handshake.auth as Record<string, string>)?.token ??
      (client.handshake.query?.token as string);

    if (!token) {
      this.logger.warn(`WS connection rejected: no token (socketId=${client.id})`);
      throw new WsException('Unauthorized: missing token');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'default-jwt-secret',
      });
      client.data.user = payload;
      return true;
    } catch {
      this.logger.warn(`WS connection rejected: invalid token (socketId=${client.id})`);
      throw new WsException('Unauthorized: invalid token');
    }
  }
}
