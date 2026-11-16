import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsInt,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTreeEntityDto {
    @ApiPropertyOptional({ description: 'Parent ID', default: 0, example: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    pid?: number = 0;

    @ApiProperty({ description: 'Node Name', example: 'Dashboard' })
    @IsNotEmpty({ message: 'Node name is required' })
    @IsString()
    @MaxLength(255)
    node_name: string;

    @ApiPropertyOptional({
        description: 'Route Name',
        example: '/admin/dashboard',
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    route_name?: string;

    @ApiPropertyOptional({
        description: 'Route Location',
        example: 'admin-dashboard',
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    route_location?: string;

    @ApiPropertyOptional({
        description: 'Icon name / class',
        example: 'dashboard-icon',
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    icon?: string;

    @ApiPropertyOptional({ description: 'Status', default: 1, example: 1 })
    @IsOptional()
    status?: number | boolean;

    @ApiProperty({ description: 'Serial order', example: 1 })
    @IsNotEmpty({ message: 'Serials is required' })
    @Type(() => Number)
    @IsInt()
    serials: number;
}
