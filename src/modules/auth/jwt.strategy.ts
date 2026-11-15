import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'accessimate-secret-key-1234567890',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub },
      include: { userInfo: true, role: true },
    });

    if (!user || user.status === 0) {
      throw new UnauthorizedException({
        status: false,
        message: 'Unauthorized access or user inactive',
      });
    }

    const { password, ...sanitized } = user;
    return sanitized;
  }
}
