import { IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RolePermissionItemDto {
    @ApiPropertyOptional({
        description: 'View permission tree entity ID',
        example: 1,
    })
    @IsOptional()
    @IsNumber()
    viewP?: number;

    @ApiPropertyOptional({
        description: 'Add permission tree entity ID',
        example: 1,
    })
    @IsOptional()
    @IsNumber()
    addP?: number;

    @ApiPropertyOptional({
        description: 'Edit permission tree entity ID',
        example: 1,
    })
    @IsOptional()
    @IsNumber()
    editP?: number;

    @ApiPropertyOptional({
        description: 'Delete permission tree entity ID',
        example: 1,
    })
    @IsOptional()
    @IsNumber()
    deleteP?: number;
}

export class UpdateRolePermissionsDto {
    @ApiPropertyOptional({ type: [RolePermissionItemDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RolePermissionItemDto)
    permissions?: RolePermissionItemDto[];

    @ApiPropertyOptional({ type: [RolePermissionItemDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RolePermissionItemDto)
    data?: RolePermissionItemDto[];
}
