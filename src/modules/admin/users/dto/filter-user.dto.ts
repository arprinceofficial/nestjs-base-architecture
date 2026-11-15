import { IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

export class FilterUserDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by role ID (user_type)' })
  @IsOptional()
  role?: string | number;
}
