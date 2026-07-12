export interface IFlowRepository {
  findByStepId(account_id: string, id: string): Promise<any>;
  findAll(account_id: string): Promise<any>;
}
