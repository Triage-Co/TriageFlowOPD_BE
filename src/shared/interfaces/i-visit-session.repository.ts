import { Prisma } from '@prisma/client';

export interface IVisitSessionRepository {
  create(data: any, tx?: Prisma.TransactionClient): Promise<any>;
  update(id: string, data: any, tx?: Prisma.TransactionClient): Promise<any>;
  findAll(patient_id?: string): Promise<any>;
  findById(id: string): Promise<any>;
  findLatestByPatient(patientId: string): Promise<any>;
  delete(id: string, tx?: Prisma.TransactionClient): Promise<any>;
}
