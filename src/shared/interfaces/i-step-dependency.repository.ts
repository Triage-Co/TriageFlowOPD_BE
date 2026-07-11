export interface IStepDependencyRepository {
  createDependency(waitingStepId: string, requiredStepId: string): Promise<any>
  update(id: string, data: any): Promise<any>;
  findAll(): Promise<any>;
  findById(id: string): Promise<any>;
  delete(id: string): Promise<any>;
}
