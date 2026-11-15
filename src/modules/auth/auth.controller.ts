import {
  Controller,
  Post,
  Body,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  OtpVerifyDto,
  SetNewPasswordDto,
} from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get auth info' })
  getUser(@Request() req: any) {
    const userId = req.user?.id || 1;
    return this.authService.getUser(userId);
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh Token' })
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refresh_token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout' })
  logout(@Request() req: any) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const userId = req.user?.id;
    return this.authService.logout(token, userId);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Forgot Password' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('otp-verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Otp Verify' })
  otpVerify(@Body() dto: OtpVerifyDto) {
    return this.authService.reqOtpVerify(dto);
  }

  @Public()
  @Post('otp-resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Otp Resend' })
  otpResend(@Body('email') email: string) {
    return this.authService.reqOtpResend(email);
  }

  @Public()
  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set password' })
  setPassword(@Body() dto: SetNewPasswordDto) {
    return this.authService.setNewPassword(dto);
  }
}
