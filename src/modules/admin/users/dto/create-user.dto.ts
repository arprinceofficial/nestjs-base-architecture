import {
    IsNotEmpty,
    IsString,
    IsEmail,
    IsOptional,
    MinLength,
    MaxLength,
    IsInt,
    IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({ description: 'Mobile number', example: '+8801700000000' })
    @IsNotEmpty({ message: 'Mobile is required' })
    @IsString()
    @MaxLength(20)
    mobile: string;

    @ApiPropertyOptional({ description: 'Country code', example: '+880' })
    @IsOptional()
    @IsString()
    @MaxLength(5)
    ccode?: string;

    @ApiProperty({ description: 'Email address', example: 'user@example.com' })
    @IsNotEmpty({ message: 'Email is required' })
    @IsEmail({}, { message: 'Invalid email address' })
    @MaxLength(255)
    email: string;

    @ApiProperty({ description: 'Password', example: 'Secret123!' })
    @IsNotEmpty({ message: 'Password is required' })
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    password: string;

    @ApiPropertyOptional({ description: 'Auth code', example: '123456' })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    auth_code?: string;

    @ApiPropertyOptional({ description: 'Is verified flag', default: 1 })
    @IsOptional()
    is_verify?: number | boolean;

    @ApiPropertyOptional({ description: 'Status', default: 1 })
    @IsOptional()
    status?: number | boolean;

    @ApiProperty({ description: 'User role type', example: '1' })
    @IsNotEmpty({ message: 'User type is required' })
    user_type: string | number;

    @ApiPropertyOptional({ description: 'Photo URL or base64' })
    @IsOptional()
    @IsString()
    photo?: string;

    // UserInfo fields
    @ApiProperty({ description: 'First name', example: 'John' })
    @IsNotEmpty({ message: 'First name is required' })
    @IsString()
    @MaxLength(255)
    first_name: string;

    @ApiPropertyOptional({ description: 'Middle name', example: 'A.' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    middle_name?: string;

    @ApiProperty({ description: 'Last name', example: 'Doe' })
    @IsNotEmpty({ message: 'Last name is required' })
    @IsString()
    @MaxLength(255)
    last_name: string;

    @ApiPropertyOptional({
        description: 'Date of birth (YYYY-MM-DD)',
        example: '1995-05-15',
    })
    @IsOptional()
    @IsString()
    dob?: string;

    @ApiPropertyOptional({ description: 'Religion ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    religion_id?: number;

    @ApiPropertyOptional({
        description: 'Gender (1=Male, 2=Female, 3=Other)',
        example: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    gender?: number;

    @ApiPropertyOptional({
        description: 'Occupation',
        example: 'Software Engineer',
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    occupation?: string;

    @ApiPropertyOptional({ description: 'Nationality ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    nationality_id?: number;

    @ApiPropertyOptional({ description: 'Vulnerability Info' })
    @IsOptional()
    vulnerability_info?: any;

    @ApiPropertyOptional({ description: 'Present Country ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    pre_country?: number;

    @ApiPropertyOptional({ description: 'Present street address' })
    @IsOptional()
    @IsString()
    pre_srteet_address?: string;

    @ApiPropertyOptional({ description: 'Present city' })
    @IsOptional()
    @IsString()
    pre_city?: string;

    @ApiPropertyOptional({ description: 'Present province / state' })
    @IsOptional()
    @IsString()
    pre_provience?: string;

    @ApiPropertyOptional({ description: 'Present zip code' })
    @IsOptional()
    @IsString()
    pre_zip?: string;

    @ApiPropertyOptional({
        description: 'Same as present address flag',
        default: true,
    })
    @IsOptional()
    same_as_present_address?: boolean | number;

    @ApiPropertyOptional({ description: 'Permanent Country ID' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    per_country?: number;

    @ApiPropertyOptional({ description: 'Permanent street address' })
    @IsOptional()
    @IsString()
    per_srteet_address?: string;

    @ApiPropertyOptional({ description: 'Permanent city' })
    @IsOptional()
    @IsString()
    per_city?: string;

    @ApiPropertyOptional({ description: 'Permanent province / state' })
    @IsOptional()
    @IsString()
    per_provience?: string;

    @ApiPropertyOptional({ description: 'Permanent zip code' })
    @IsOptional()
    @IsString()
    per_zip?: string;
}
