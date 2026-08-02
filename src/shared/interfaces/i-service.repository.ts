import { Prisma, Service, ServiceTypeEnum, Staff } from '@prisma/client';

export interface IServiceRepository {
  findByCode(code: string): Promise<Service | null>
  create(
    data: Prisma.ServiceUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service>;
  update(
    id: string,
    data: Prisma.ServiceUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Service>;
  findAll(
    page?: number,
    limit?: number,
    service_type?: ServiceTypeEnum,
  ): Promise<
    Partial<{
      data: Partial<Service>[];
      meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>
  >;
  findById(id: string): Promise<Partial<Service> | null>;
  findByServiceCode(code: string): Promise<Partial<Service> | null>;
  delete(id: string, tx?: Prisma.TransactionClient): Promise<Service>;
}
