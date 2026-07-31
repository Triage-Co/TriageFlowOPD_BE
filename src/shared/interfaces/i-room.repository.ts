import { ClinicalRoomType, Prisma, Room } from '@prisma/client';

export type RoomWithStaff = Prisma.RoomGetPayload<{
  include: {
    shifts: {
      include: {
        staff: true;
      }
    }
  };
}>;
export interface IRoomRepository {
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
  findAll(): Promise<any>;
  findById(id: string): Promise<any>;
  delete(id: string): Promise<any>;
  createMany(data: any): Promise<any>;
  findByType(type: ClinicalRoomType): Promise<Room[]>;
  countByType(type: ClinicalRoomType): Promise<number>;
  countAll(): Promise<number>;
  findBestRoomBySpecialtyId(specialty_id: string): Promise<RoomWithStaff | null>;
  findBestRoomByRoomType(room_type: ClinicalRoomType): Promise<RoomWithStaff | null>;
}
