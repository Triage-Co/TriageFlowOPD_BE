export interface ITemplateRepository {
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
  findAll(): Promise<any>;
  findById(id: string): Promise<any>;
  findByName(templateName: string): Promise<any>;
  delete(id: string): Promise<any>;
}
