import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/interfaces/api-response.interface';

@Injectable()
export class CustomerService {
  async getStatus(): Promise<ApiResponse> {
    return {
      status: true,
      message: 'Customer API Module is active and operational.',
      data: {
        domain: 'customer',
        version: 'v1',
      },
    };
  }
}
