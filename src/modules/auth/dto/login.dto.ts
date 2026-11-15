import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Email or Mobile number', example: 'admin@example.com' })
  @IsNotEmpty({ message: 'Login ID (email or mobile) is required' })
  @IsString()
  login_id: string;

  @ApiProperty({ description: 'Password', example: 'Password123!' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ description: 'Country code if mobile is used', example: '+880' })
  @IsOptional()
  @IsString()
  ccode?: string;
}

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: 'Refresh token' })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Email address', example: 'admin@example.com' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsString()
  email: string;
}

export class OtpVerifyDto {
  @ApiProperty({ description: 'Email address', example: 'admin@example.com' })
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({ description: 'OTP Code', example: '123456' })
  @IsNotEmpty()
  @IsString()
  otp: string;
}

export class SetNewPasswordDto {
  @ApiProperty({ description: 'Email address', example: 'admin@example.com' })
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({ description: 'Reset Token or OTP', example: '123456' })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({ description: 'New password', example: 'NewSecret123!' })
  @IsNotEmpty()
  @IsString()
  password: string;
}
