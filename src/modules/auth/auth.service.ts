import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  LoginDto,
  ForgotPasswordDto,
  OtpVerifyDto,
  SetNewPasswordDto,
} from './dto/login.dto';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { ApiMessages } from '../../common/constants/api-messages.constant';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private sanitizeUser(user: any) {
    if (!user) return user;
    const { password, ...sanitized } = user;
    return sanitized;
  }

  async login(dto: LoginDto): Promise<ApiResponse> {
    const isEmail = dto.login_id.includes('@');
    const user = await this.prisma.user.findFirst({
      where: isEmail
        ? { email: dto.login_id }
        : { mobile: dto.login_id },
      include: { userInfo: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException({
        status: false,
        message: 'Invalid credentials',
      });
    }

    if (user.status === 0) {
      throw new UnauthorizedException({
        status: false,
        message: 'Account is deactivated',
      });
    }

    const isPasswordValid = user.password
      ? await bcrypt.compare(dto.password, user.password)
      : false;

    if (!isPasswordValid) {
      throw new UnauthorizedException({
        status: false,
        message: 'Invalid credentials',
      });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role_id: user.user_type,
    };

    const token = this.jwtService.sign(payload, { expiresIn: '24h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    const userData = {
      ...this.sanitizeUser(user),
      token,
      refresh_token: refreshToken,
      expire_time: 1440,
    };

    return {
      status: true,
      message: 'Login successful.',
      data: userData,
    };
  }

  async getUser(userId: number): Promise<ApiResponse> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      include: { userInfo: true, role: true },
    });

    if (!user) {
      throw new NotFoundException({
        status: false,
        message: ApiMessages.NODATA,
      });
    }

    return {
      status: true,
      message: ApiMessages.SHOW,
      data: this.sanitizeUser(user),
    };
  }

  async refreshToken(refreshTokenStr?: string): Promise<ApiResponse> {
    if (!refreshTokenStr) {
      throw new BadRequestException({
        status: false,
        message: 'Refresh token is required',
      });
    }

    try {
      const decoded = this.jwtService.verify(refreshTokenStr);
      const user = await this.prisma.user.findFirst({
        where: { id: decoded.sub, status: 1 },
      });

      if (!user) {
        throw new UnauthorizedException({
          status: false,
          message: 'User not found or inactive',
        });
      }

      const payload = {
        sub: user.id,
        email: user.email,
        role_id: user.user_type,
      };

      const token = this.jwtService.sign(payload, { expiresIn: '24h' });
      const newRefreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

      return {
        status: true,
        message: 'Token refreshed successfully.',
        data: {
          token,
          refresh_token: newRefreshToken,
          expire_time: 1440,
        },
      };
    } catch {
      throw new UnauthorizedException({
        status: false,
        message: 'Invalid or expired refresh token',
      });
    }
  }

  async logout(): Promise<ApiResponse> {
    return {
      status: true,
      message: 'Logged out successfully.',
      data: null,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<ApiResponse> {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException({
        status: false,
        message: 'No user found with this email.',
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        auth_code: otp,
        otp_expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    return {
      status: true,
      message: 'OTP sent successfully for password reset.',
      data: {
        email: dto.email,
        otp_mock: process.env.NODE_ENV !== 'production' ? otp : undefined,
      },
    };
  }

  async reqOtpVerify(dto: OtpVerifyDto): Promise<ApiResponse> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, auth_code: dto.otp },
    });

    if (!user) {
      throw new BadRequestException({
        status: false,
        message: 'Invalid OTP code.',
      });
    }

    if (user.otp_expires_at && user.otp_expires_at < new Date()) {
      throw new BadRequestException({
        status: false,
        message: 'OTP code has expired.',
      });
    }

    return {
      status: true,
      message: 'OTP verified successfully.',
      data: { verified: true },
    };
  }

  async reqOtpResend(email: string): Promise<ApiResponse> {
    return this.forgotPassword({ email });
  }

  async setNewPassword(dto: SetNewPasswordDto): Promise<ApiResponse> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, auth_code: dto.token },
    });

    if (!user) {
      throw new BadRequestException({
        status: false,
        message: 'Invalid reset token or email.',
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        auth_code: null,
        otp_expires_at: null,
      },
    });

    return {
      status: true,
      message: 'Password has been reset successfully.',
      data: null,
    };
  }
}
