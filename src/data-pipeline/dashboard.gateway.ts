import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EtlRecord, EtlResult } from './etl.service';
import { DataWarehouseService } from './data-warehouse.service';

@WebSocketGateway({ namespace: '/dashboard', cors: { origin: '*' } })
export class DashboardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DashboardGateway.name);

  constructor(private readonly warehouse: DataWarehouseService) {}

  handleConnection(client: Socket): void {
    this.logger.log(`Dashboard client connected: ${client.id}`);
    // Send current snapshot on connect
    client.emit('snapshot', {
      totalRecords: this.warehouse.count(),
      bySource: this.warehouse.aggregate(),
    });
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Dashboard client disconnected: ${client.id}`);
  }

  @SubscribeMessage('getSnapshot')
  handleGetSnapshot(@MessageBody() _data: unknown) {
    return {
      totalRecords: this.warehouse.count(),
      bySource: this.warehouse.aggregate(),
    };
  }

  @OnEvent('etl.record.loaded')
  broadcastRecord(record: EtlRecord): void {
    this.server?.emit('record', {
      id: record.id,
      source: record.source,
      timestamp: record.timestamp,
    });
  }

  @OnEvent('etl.run.complete')
  broadcastRunComplete(payload: { source: string; result: EtlResult }): void {
    this.server?.emit('etlComplete', payload);
  }
}
