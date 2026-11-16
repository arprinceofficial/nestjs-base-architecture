import { IsNotEmpty, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteMenuDto {
    @ApiProperty({ description: 'Tree entity ID', example: 1 })
    @IsNotEmpty({ message: 'ID is required' })
    @Type(() => Number)
    @IsInt()
    id: number;

    @ApiProperty({
        description: 'New status (0 for inactive/delete, 1 for active)',
        example: 0,
    })
    @IsNotEmpty({ message: 'Status is required' })
    @Type(() => Number)
    @IsInt()
    status: number;
}
