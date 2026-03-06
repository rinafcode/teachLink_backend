import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
} from "@nestjs/websockets";
import { UseGuards } from "@nestjs/common";
import { Socket } from "socket.io";
import { WsJwtAuthGuard } from "../auth/guards/ws-jwt-auth.guard";

@WebSocketGateway({ namespace: "/notifications" })
export class NotificationsGateway {
  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage("subscribe_notifications")
  async handleSubscribe(@ConnectedSocket() client: Socket) {
    const user = (client as any).user;
    return { userId: user.sub, subscribed: true };
  }
}
