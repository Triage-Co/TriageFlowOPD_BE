import { Prisma, RoleTypeEnum } from "@prisma/client";

export interface IStaffRepository {
  create(data: any): Promise<any>;
  update(id: string, data: any, tx?: Prisma.TransactionClient): Promise<any>;
  findAll(): Promise<any>;
  findById(id: string): Promise<any>;
}
