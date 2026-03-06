import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from "@nestjs/websockets";
import { UseGuards } from "@nestjs/common";
import { Socket } from "socket.io";
import { WsJwtAuthGuard } from "../auth/guards/ws-jwt-auth.guard";

@WebSocketGateway({ namespace: "/messaging" })
export class MessagingGateway implements OnGatewayConnection {
  async handleConnection(client: Socket) {
    // Guard will disconnect unauthorized clients
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage("send_message")
  async handleMessage(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const user = (client as any).user;
    return { userId: user.sub, message: data };
  }
}
