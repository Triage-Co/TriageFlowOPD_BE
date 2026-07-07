export interface IPatientRepository {
  create(id: string): Promise<any>;
}
