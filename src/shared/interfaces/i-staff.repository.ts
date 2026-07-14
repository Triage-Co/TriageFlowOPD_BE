import { RoleTypeEnum } from "@prisma/client";

export interface IStaffRepository {
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
  findAll(): Promise<any>;
  findById(id: string): Promise<any>;
  delete(id: string): Promise<any>;
}
