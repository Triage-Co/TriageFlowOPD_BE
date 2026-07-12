export interface IRoomRepository {
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
  findAll(): Promise<any>;
  findById(id: string): Promise<any>;
  delete(id: string): Promise<any>;
  createMany(data: any): Promise<any>;
}
