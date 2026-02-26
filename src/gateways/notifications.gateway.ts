import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  UseGuards,
} from "@nestjs/websockets";
import { Socket } from "socket.io";
import { WsJwtAuthGuard } from "../common/guards/ws-jwt-auth.guard";

@WebSocketGateway({ namespace: "/notifications" })
export class NotificationsGateway {
  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage("subscribe_notifications")
  async handleSubscribe(@ConnectedSocket() client: Socket) {
    const user = (client as any).user;
    // subscribe user to notifications
    return { userId: user.sub, subscribed: true };
  }
}
