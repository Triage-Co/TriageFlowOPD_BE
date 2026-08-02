import { Flow, Prisma } from '@prisma/client';

export interface IFlowRepository {
  findAll(): Promise<any>;
  findByFlowId(flow_id: string): Promise<any>;
  findAllByPatientId(patient_id: string): Promise<any>;
  findIsActiveByPatientId(account_id: string, date?: String): Promise<any>;

  create(
    data: Prisma.FlowUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Flow>;
}
