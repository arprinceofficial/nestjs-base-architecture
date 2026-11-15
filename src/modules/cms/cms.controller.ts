import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CmsService } from './cms.service';
import { Public } from '../admin/auth/decorators/public.decorator';

@ApiTags('CMS')
@Controller()
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'Check CMS module status' })
  getStatus() {
    return this.cmsService.getStatus();
  }
}
