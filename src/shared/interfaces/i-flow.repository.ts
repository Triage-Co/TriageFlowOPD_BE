export interface IFlowRepository {
  findAll(): Promise<any>;
  findByFlowId(flow_id: string): Promise<any>;
  findAllByPatientId(patient_id: string): Promise<any>;
  findIsActiveByPatientId(account_id: string): Promise<any>;
}
