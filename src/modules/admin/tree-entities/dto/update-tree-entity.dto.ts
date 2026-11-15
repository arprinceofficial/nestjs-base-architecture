import { IsOptional, IsString, IsInt, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTreeEntityDto {
  @ApiPropertyOptional({ description: 'Parent ID', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pid?: number;

  @ApiPropertyOptional({ description: 'Node Name', example: 'Dashboard' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  node_name?: string;

  @ApiPropertyOptional({ description: 'Route Name', example: '/admin/dashboard' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  route_name?: string;

  @ApiPropertyOptional({ description: 'Route Location', example: 'admin-dashboard' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  route_location?: string;

  @ApiPropertyOptional({ description: 'Icon name / class', example: 'dashboard-icon' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  icon?: string;

  @ApiPropertyOptional({ description: 'Status', example: 1 })
  @IsOptional()
  status?: number | boolean;

  @ApiPropertyOptional({ description: 'Serial order', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  serials?: number;
}
