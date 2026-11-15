import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/modules/mail/mail.service';
import {
  LoginDto,
  ForgotPasswordDto,
  OtpVerifyDto,
  SetNewPasswordDto,
} from './dto/login.dto';
import { ApiResponse } from '@/common/interfaces/api-response.interface';
import { ApiMessages } from '@/common/constants/api-messages.constant';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  private getJwtExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN') || '24h';
  }

  private getJwtRefreshExpiresIn(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
  }

  private getExpiresInMinutes(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd]?)$/);
    if (!match) return 1440;
    const val = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return Math.ceil(val / 60);
      case 'm':
        return val;
      case 'h':
        return val * 60;
      case 'd':
        return val * 1440;
      default:
        return Math.ceil(val / 60);
    }
  }

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

    const expiresIn = this.getJwtExpiresIn();
    const refreshExpiresIn = this.getJwtRefreshExpiresIn();
    const expireTimeMinutes = this.getExpiresInMinutes(expiresIn);

    const token = this.jwtService.sign(payload, { expiresIn: expiresIn as any });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: refreshExpiresIn as any });

    const userData = {
      ...this.sanitizeUser(user),
      token,
      refresh_token: refreshToken,
      expire_time: expireTimeMinutes,
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

      const expiresIn = this.getJwtExpiresIn();
      const refreshExpiresIn = this.getJwtRefreshExpiresIn();
      const expireTimeMinutes = this.getExpiresInMinutes(expiresIn);

      const token = this.jwtService.sign(payload, { expiresIn: expiresIn as any });
      const newRefreshToken = this.jwtService.sign(payload, { expiresIn: refreshExpiresIn as any });

      return {
        status: true,
        message: 'Token refreshed successfully.',
        data: {
          token,
          refresh_token: newRefreshToken,
          expire_time: expireTimeMinutes,
        },
      };
    } catch {
      throw new UnauthorizedException({
        status: false,
        message: 'Invalid or expired refresh token',
      });
    }
  }

  async logout(token?: string, userId?: number): Promise<ApiResponse> {
    if (token) {
      // 1. Decode token to extract its expiration timestamp
      let expiresAt: Date | undefined;
      try {
        const decoded = this.jwtService.decode(token) as any;
        if (decoded && decoded.exp) {
          expiresAt = new Date(decoded.exp * 1000);
        }
      } catch {
        // Fallback if token cannot be decoded
      }

      await this.prisma.revokedToken.upsert({
        where: { token },
        update: {
          expires_at: expiresAt,
        },
        create: {
          token,
          user_id: userId || null,
          expires_at: expiresAt,
        },
      });

      // 2. Performance optimization: Prune naturally expired revoked tokens
      // Tokens past their expiration are already rejected by JWT signature check,
      // so deleting them prevents the table from growing large.
      await this.prisma.revokedToken.deleteMany({
        where: {
          expires_at: { lt: new Date() },
        },
      });
    }

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

    // Send email via SMTP if SMTP_ENABLED=true; otherwise skips and retains in DB
    await this.mailService.sendOtpEmail(dto.email, otp);

    return {
      status: true,
      message: 'OTP sent successfully for password reset.',
      data: {
        email: dto.email,
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
