import { Step } from "@prisma/client";

export interface IStepRepository {
  createParentStep(data: any): Promise<any>;
  createSubStep(data: any): Promise<any>;
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
}
