import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { QueueService } from '../../routes/queue/queue.service';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class QueueGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
  ) {}

  handleConnection(client: any, ...args: any[]) {
    console.log(`Đã kết nối ${client.id}`);
  }

  handleDisconnect(client: any) {
    console.log(`Ngắt kết nối ${client.id}`);
  }

  @SubscribeMessage('joinRoomDisplay')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; staffId: string },
  ) {
    const roomName = `room_${payload.roomId}`;
    client.join(roomName);
    console.log(`${client.id} đã tham gia ${roomName}`);

    if (payload.roomId && payload.staffId) {
      try {
        const currentState = await this.queueService.getRoomDisplayPayload(
          payload.roomId,
          payload.staffId,
        );
        client.emit('onQueueUpdate', currentState);
      } catch (error) {
        console.error('Lỗi khi fetch initial TV state', error);
      }
    }
  }

  emitQueueUpdate(roomId: string, data: any) {
    this.server.to(`room_${roomId}`).emit('onQueueUpdate', data);
  }
}
