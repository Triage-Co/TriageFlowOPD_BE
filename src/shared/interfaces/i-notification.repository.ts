export interface INotificationRepository {
  create(data: any, tx?: any): Promise<any>;
  findAll(account_id: string): Promise<any>;
  deleteAll(account_id: string): Promise<any>;
  delete(account_id: string, id: string): Promise<any>;
}
