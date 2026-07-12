export interface IFlowRepository {
  findByStepId(account_id: string, id: string): Promise<any>;
  findAllByAccountId(account_id: string): Promise<any>;
  findAll(): Promise<any>;
  findById(flow_id: string): Promise<any>;
}
