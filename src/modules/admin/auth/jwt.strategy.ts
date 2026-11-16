import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey:
                configService.get<string>('JWT_SECRET') ||
                'app-default-jwt-secret-key-replace-in-env',
            passReqToCallback: true,
        });
    }

    async validate(req: any, payload: any) {
        const rawToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        if (rawToken) {
            const isRevoked = await this.prisma.revokedToken.findUnique({
                where: { token: rawToken },
            });
            if (isRevoked) {
                throw new UnauthorizedException({
                    status: false,
                    message:
                        'Token has been revoked or user logged out. Please log in again.',
                });
            }
        }

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
