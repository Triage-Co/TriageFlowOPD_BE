export interface IStaffRepository {
  create(id: string): Promise<any>;
}
