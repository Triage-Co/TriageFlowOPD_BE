import { Prisma} from "@prisma/client";

export type RoomServiceWithRoomAndService = Prisma.Room_ServiceGetPayload<{
    include: {
        room: true,
        service: true
    }
}>

export interface IRoomServiceRepository {
    findOneByRoomId(roomId: string): Promise<RoomServiceWithRoomAndService | null>
}