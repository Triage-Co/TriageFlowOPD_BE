import { Prisma, Step } from '@prisma/client';

export type StepWithBookingAndSlot = Prisma.StepGetPayload<{
  include: {
    queues: true;
    room: true;
    service_order: {
      include: {
        booking: {
          include: {
            slot: true;
          };
        };
      };
    };
  };
}>;

export interface IStepRepository {
  createParentStep(
    data: Prisma.StepUncheckedCreateWithoutParent_stepInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Step>;
  createSubStep(
    data: Prisma.StepUncheckedCreateWithoutFlowInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Step>;
  createDependency(waitingStepId: string, requiredStepId: string): Promise<any>;
  update(id: string, data: any): Promise<any>;
  findAll(): Promise<any>;
  findById(id: string): Promise<any>;
  delete(id: string): Promise<any>;
  findByIdAndAccountId(account_id: string, id: string): Promise<any>;
  findSubStepsByParentId(parentId: string): Promise<any>;
  findDependentSteps(stepId: string): Promise<any>;
  findDependenciesOfStep(stepId: string): Promise<any>;
  findStepByIdAndPatientId(
    stepId: string,
    patientId: string,
  ): Promise<Step | null>;
  findPendingPaymentStepsByPatientId(patientId: string): Promise<Step[]>;
  getById(id: string): Promise<StepWithBookingAndSlot | null>;
}
