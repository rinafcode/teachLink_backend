import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Socket } from "socket.io";

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      client.disconnect(true);
      return false;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      (client as any).user = payload; // attach user context
      return true;
    } catch (err) {
      client.disconnect(true);
      return false;
    }
  }
}
