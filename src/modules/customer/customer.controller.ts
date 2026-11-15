import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { Public } from '../admin/auth/decorators/public.decorator';

@ApiTags('Customer')
@Controller()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'Check Customer module status' })
  getStatus() {
    return this.customerService.getStatus();
  }
}
