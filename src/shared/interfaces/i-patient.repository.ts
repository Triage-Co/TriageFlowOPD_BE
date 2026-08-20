import { Prisma } from '@prisma/client';

export interface IPatientRepository {
  create(
    account_id: string,
    data: any,
    tx?: Prisma.TransactionClient,
  ): Promise<any>;
  update(
    patient_id: string,
    data: any,
    account_id?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any>;
  findAll(
    account_id?: string,
    page?: number,
    limit?: number,
    search?: string,
  ): Promise<any>;
  findOne(patient_id: string, account_id?: string): Promise<any>;
  findOneWithPatientId(patient_id: string): Promise<any>;
  delete(
    patient_id: string,
    account_id?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any>;
  findByCitizenId(citizenId: string): Promise<any>;
}
