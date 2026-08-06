import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
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
import { JwtService } from '@nestjs/jwt';
import { QueueService } from '../../routes/queue/queue.service';

const getCorsOrigins = (): string[] | string => {
  const allowed = process.env.WS_ALLOWED_ORIGINS;
  if (!allowed) {
    return ['http://localhost:3000', 'http://localhost:8000'];
  }
  const origins = allowed.split(',').map((o) => o.trim()).filter(Boolean);
  return origins.length > 0 ? origins : '*';
};

@Injectable()
@WebSocketGateway({
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
})
export class QueueGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(QueueGateway.name);

  constructor(
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        (client.handshake.headers?.authorization
          ? client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : null);

      if (token) {
        try {
          const payload = await this.jwtService.verifyAsync(token);
          client.data = { ...client.data, user: payload };
          this.logger.log(`Client authenticated: ${client.id} (user: ${payload.sub || payload.id || 'valid'})`);
        } catch (err: any) {
          // Staff Supabase JWTs are not signed with KIOSK_KEY — fall back to anonymous TV mode
          // instead of disconnecting (TV only listens; mutations stay on authenticated HTTP APIs).
          client.data = { ...client.data, user: null };
          this.logger.warn(
            `Client ${client.id} token unverifiable (${err.message}); connected as anonymous TV`,
          );
        }
      } else {
        // Anonymous TV mode: allow connection, mark user as null
        client.data = { ...client.data, user: null };
        this.logger.log(`Client connected anonymously (TV mode): ${client.id}`);
      }
    } catch (error: any) {
      this.logger.error(`Error handling connection for ${client.id}: ${error.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('leaveRoomDisplay')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    if (payload?.roomId && typeof payload.roomId === 'string') {
      const roomName = `room_${payload.roomId.trim()}`;
      client.leave(roomName);
      this.logger.log(`${client.id} left ${roomName}`);
    }
  }

  @SubscribeMessage('joinRoomDisplay')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; staffId?: string },
  ) {
    if (!payload || !payload.roomId || typeof payload.roomId !== 'string' || payload.roomId.trim() === '') {
      this.logger.warn(`Client ${client.id} passed invalid roomId in joinRoomDisplay`);
      client.emit('onError', { message: 'roomId is required and must be a non-empty string' });
      return;
    }

    const roomId = payload.roomId.trim();

    // Auto-leave any previous room starting with "room_"
    for (const room of client.rooms) {
      if (room !== client.id && room.startsWith('room_')) {
        client.leave(room);
        this.logger.log(`${client.id} auto-left ${room}`);
      }
    }

    const roomName = `room_${roomId}`;
    client.join(roomName);
    this.logger.log(`${client.id} joined ${roomName}`);

    try {
      const currentState = await this.queueService.getRoomDisplayPayload(
        roomId,
        payload.staffId,
      );
      client.emit('onQueueUpdate', currentState);
    } catch (error: any) {
      this.logger.error(`Error fetching initial TV state for room ${roomId}: ${error?.message || error}`);
      client.emit('onError', {
        message: 'Không thể lấy dữ liệu phòng',
        roomId,
      });
    }
  }

  emitQueueUpdate(roomId: string, data: any) {
    this.server.to(`room_${roomId}`).emit('onQueueUpdate', data);
  }

  emitRebalanceSuggestion(fromRoomId: string, toRoomId: string, suggestionData: any) {
    this.server.to(`room_${fromRoomId}`).emit('onRebalanceSuggestion', suggestionData);
    this.server.to(`room_${toRoomId}`).emit('onRebalanceSuggestion', suggestionData);
  }

  emitRebalanceResolved(
    fromRoomId: string,
    toRoomId: string,
    data: { suggestion_id: string; status: string },
  ) {
    this.server.to(`room_${fromRoomId}`).emit('onRebalanceResolved', data);
    this.server.to(`room_${toRoomId}`).emit('onRebalanceResolved', data);
  }
}

