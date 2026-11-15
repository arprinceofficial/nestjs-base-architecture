import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiPropertyOptional({ description: 'Role name', example: 'Manager' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  role_name?: string;

  @ApiPropertyOptional({ description: 'Status', example: 1 })
  @IsOptional()
  status?: number | boolean;
}
