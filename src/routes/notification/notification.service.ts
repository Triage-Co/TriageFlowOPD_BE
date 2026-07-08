import { Inject, Injectable } from '@nestjs/common';
import type { INotificationRepository } from '../../shared/interfaces/i-notification.repository';

@Injectable()
export class NotificationService {
  constructor(
    @Inject('INotificationRepository')
    private readonly notificationRepository: INotificationRepository,
  ) {}
  async findAll(account_id: string) {
    const data = await this.notificationRepository.findAll(account_id);
    return {
      code: 200,
      status: 'success',
      message: 'Lấy thông báo thành công',
      data: data,
    };
  }

  async remove(account_id: string, id: string) {
    await this.notificationRepository.delete(account_id, id);
    return {
      code: 200,
      status: 'success',
      message: `xóa thông báo với id ${id} thành công`,
    };
  }
  async removeAll(account_id: string) {
    await this.notificationRepository.deleteAll(account_id);
    return {
      code: 200,
      status: 'success',
      message: `xóa thông báo thành công`,
    };
  }
}
