import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
    @ApiProperty({ description: 'Role name', example: 'Admin' })
    @IsNotEmpty({ message: 'Role name is required' })
    @IsString()
    @MaxLength(255)
    role_name: string;

    @ApiPropertyOptional({ description: 'Status', example: 1, default: 1 })
    @IsOptional()
    status?: number | boolean;
}
