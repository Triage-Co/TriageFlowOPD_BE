export interface IQueueRepository {
  findByStepId(id: string): Promise<any>;
}
