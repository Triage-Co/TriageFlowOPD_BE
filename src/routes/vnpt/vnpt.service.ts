import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import envInstance from '../../shared/config/env.config';

@Injectable()
export class VnptService {
  VNPT_TOKEN_KEY: string;
  VNPT_TOKEN_ID: string;
  VNPT_ACCESS_TOKEN: string;

  constructor() {
    this.VNPT_ACCESS_TOKEN = envInstance.VNPT_ACCESS_TOKEN;
    this.VNPT_TOKEN_ID = envInstance.VNPT_TOKEN_ID;
    this.VNPT_TOKEN_KEY = envInstance.VNPT_TOKEN_KEY;
  }

  findAll() {
    return {
      code: 200,
      message: 'Lấy thông tin thành công',
      status: 'success',
      data: {
        access_token: this.VNPT_ACCESS_TOKEN,
        token_id: this.VNPT_TOKEN_ID,
        token_key: this.VNPT_TOKEN_KEY,
      },
    };
  }
}
