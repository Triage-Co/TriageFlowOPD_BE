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

  createManyParentStep(
    data: Prisma.StepCreateManyInput[],
    tx?: Prisma.TransactionClient,
  ): Promise<Step[]>;

  createSubStep(
    data: Prisma.StepUncheckedCreateWithoutFlowInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Step>;
  createDependency(waitingStepId: string, requiredStepId: string): Promise<any>;
  updateDependency(
    waitingStepId: string,
    oldRequiredStepId: string,
    newRequiredStepId: string,
  ): Promise<any>;
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
  findClinicalStepByServiceOrderId(
    serviceOrderId: string,
  ): Promise<Step | null>;
  /** All non-PAYMENT, non-CANCELLED steps for a service order (oldest first). */
  findNonPaymentStepsByServiceOrderId(serviceOrderId: string): Promise<Step[]>;
  /** Primary clinical step used to hang the single queue ticket for an SO. */
  findPrimaryClinicalStepByServiceOrderId(
    serviceOrderId: string,
  ): Promise<Step | null>;
  findPaymentStepByServiceOrderId(serviceOrderId: string): Promise<Step | null>;
  getById(id: string): Promise<StepWithBookingAndSlot | null>;
}
