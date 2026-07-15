export interface IPatientRepository {
  create(account_id: string, data: any): Promise<any>;
  update(account_id: string, patient_id: string, data: any): Promise<any>;
  findAll(account_id?: string): Promise<any>;
  findOne(patient_id: string, account_id?: string): Promise<any>;
  findOneWithPatientId(patient_id: string): Promise<any>;
  delete(account_id: string, patient_id: string): Promise<any>;
}
