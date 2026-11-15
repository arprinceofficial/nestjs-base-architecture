import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/interfaces/api-response.interface';

@Injectable()
export class CmsService {
  async getStatus(): Promise<ApiResponse> {
    return {
      status: true,
      message: 'CMS Module is active and operational.',
      data: {
        domain: 'cms',
        version: 'v1',
      },
    };
  }
}
