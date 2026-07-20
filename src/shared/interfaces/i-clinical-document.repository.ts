import { Prisma } from '@prisma/client';

export interface IClinicalDocumentRepository {
  create(data: any, tx?: Prisma.TransactionClient): Promise<any>;
  update(id: string, data: any, tx?: Prisma.TransactionClient): Promise<any>;
  findAll(visit_session_id?: string): Promise<any>;
  findById(id: string): Promise<any>;
  delete(id: string, tx?: Prisma.TransactionClient): Promise<any>;
}
