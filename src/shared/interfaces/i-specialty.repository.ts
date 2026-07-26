import { Specialty } from '@prisma/client';

export interface ISpecialtyRepository {
  findAll(page?: number, limit?: number): Promise<Partial<Specialty>[]>;
}
