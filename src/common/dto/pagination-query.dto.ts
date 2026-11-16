import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
    @ApiPropertyOptional({ description: 'Enable pagination' })
    @IsOptional()
    @Transform(
        ({ value }) =>
            value === true || value === 'true' || value === 1 || value === '1',
    )
    @IsBoolean()
    paginate?: boolean;

    @ApiPropertyOptional({ description: 'Page number', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Items per page', default: 15 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    length?: number = 15;

    @ApiPropertyOptional({ description: 'Search keyword' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'Status filter' })
    @IsOptional()
    status?: string | number;

    @ApiPropertyOptional({
        description: 'Trashed filter: "with" or "only"',
        enum: ['with', 'only'],
    })
    @IsOptional()
    @IsString()
    trashed?: 'with' | 'only';
}
