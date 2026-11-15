import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { ApiMessages } from '../../common/constants/api-messages.constant';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeUser(user: any) {
    if (!user) return user;
    const { password, ...sanitized } = user;
    return sanitized;
  }

  async findAll(query: FilterUserDto): Promise<ApiResponse> {
    const where: Prisma.UserWhereInput = {};

    if (query.trashed === 'with') {
      // include deleted
    } else if (query.trashed === 'only') {
      where.userInfo = {
        deleted_at: { not: null },
      };
    } else {
      where.userInfo = {
        deleted_at: null,
      };
    }

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { mobile: { contains: query.search, mode: 'insensitive' } },
        { userInfo: { first_name: { contains: query.search, mode: 'insensitive' } } },
        { userInfo: { last_name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    if (query.role !== undefined && query.role !== null && query.role !== '') {
      where.user_type = Number(query.role);
    }

    if (query.status !== undefined && query.status !== null && query.status !== '') {
      where.status =
        query.status === 'true' || query.status === 1 || query.status === '1' ? 1 : 0;
    }

    if (query.paginate) {
      const page = Number(query.page) || 1;
      const limit = Number(query.length) || 15;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          include: { userInfo: true, role: true },
          orderBy: { id: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.user.count({ where }),
      ]);

      const lastPage = Math.ceil(total / limit);

      return {
        status: true,
        message: ApiMessages.GETALL,
        data: {
          data: data.map((u) => this.sanitizeUser(u)),
          total,
          current_page: page,
          per_page: limit,
          last_page: lastPage,
          permissions: {},
        },
      };
    }

    const data = await this.prisma.user.findMany({
      where,
      include: { userInfo: true, role: true },
      orderBy: { id: 'desc' },
    });

    return {
      status: true,
      message: ApiMessages.GETALL,
      data: {
        data: data.map((u) => this.sanitizeUser(u)),
        permissions: {},
      },
    };
  }

  async findOne(id: number): Promise<ApiResponse> {
    const user = await this.prisma.user.findFirst({
      where: { id },
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

  async create(dto: CreateUserDto): Promise<ApiResponse> {
    const existingEmail = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (existingEmail) {
      throw new BadRequestException({
        status: false,
        message: `User with email '${dto.email}' already exists.`,
      });
    }

    const existingMobile = await this.prisma.user.findFirst({ where: { mobile: dto.mobile } });
    if (existingMobile) {
      throw new BadRequestException({
        status: false,
        message: `User with mobile '${dto.mobile}' already exists.`,
      });
    }

    try {
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const uid = randomUUID();

      const user = await this.prisma.user.create({
        data: {
          uid,
          email: dto.email,
          mobile: dto.mobile,
          ccode: dto.ccode,
          password: hashedPassword,
          auth_code: dto.auth_code,
          is_verify: dto.is_verify !== undefined ? (dto.is_verify ? 1 : 0) : 1,
          status: dto.status !== undefined ? (dto.status ? 1 : 0) : 1,
          user_type: Number(dto.user_type),
          photo: dto.photo,
          userInfo: {
            create: {
              first_name: dto.first_name,
              middle_name: dto.middle_name,
              last_name: dto.last_name,
              photo: dto.photo,
              dob: dto.dob ? new Date(dto.dob) : null,
              religion_id: dto.religion_id,
              gender: dto.gender,
              occupation: dto.occupation,
              nationality_id: dto.nationality_id,
              vulnerability_info: dto.vulnerability_info,
              pre_country: dto.pre_country,
              pre_srteet_address: dto.pre_srteet_address,
              pre_city: dto.pre_city,
              pre_provience: dto.pre_provience,
              pre_zip: dto.pre_zip,
              same_as_present_address:
                dto.same_as_present_address !== undefined
                  ? dto.same_as_present_address
                    ? 1
                    : 0
                  : 1,
              per_country: dto.per_country,
              per_srteet_address: dto.per_srteet_address,
              per_city: dto.per_city,
              per_provience: dto.per_provience,
              per_zip: dto.per_zip,
            },
          },
        },
        include: { userInfo: true, role: true },
      });

      return {
        status: true,
        message: ApiMessages.STORE,
        data: this.sanitizeUser(user),
      };
    } catch (error: any) {
      throw new InternalServerErrorException({
        status: false,
        message: error.message || ApiMessages.FAILSTORE,
      });
    }
  }

  async update(id: number, dto: UpdateUserDto): Promise<ApiResponse> {
    const user = await this.prisma.user.findFirst({
      where: { id },
      include: { userInfo: true },
    });

    if (!user) {
      throw new NotFoundException({
        status: false,
        message: ApiMessages.NODATA,
      });
    }

    if (dto.email && dto.email !== user.email) {
      const existingEmail = await this.prisma.user.findFirst({ where: { email: dto.email } });
      if (existingEmail && existingEmail.id !== id) {
        throw new BadRequestException({
          status: false,
          message: `User with email '${dto.email}' already exists.`,
        });
      }
    }

    if (dto.mobile && dto.mobile !== user.mobile) {
      const existingMobile = await this.prisma.user.findFirst({ where: { mobile: dto.mobile } });
      if (existingMobile && existingMobile.id !== id) {
        throw new BadRequestException({
          status: false,
          message: `User with mobile '${dto.mobile}' already exists.`,
        });
      }
    }

    try {
      let hashedPassword: string | undefined = undefined;
      if (dto.password) {
        hashedPassword = await bcrypt.hash(dto.password, 10);
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id },
          data: {
            ...(dto.email !== undefined && { email: dto.email }),
            ...(dto.mobile !== undefined && { mobile: dto.mobile }),
            ...(dto.ccode !== undefined && { ccode: dto.ccode }),
            ...(dto.auth_code !== undefined && { auth_code: dto.auth_code }),
            ...(dto.is_verify !== undefined && { is_verify: dto.is_verify ? 1 : 0 }),
            ...(dto.status !== undefined && { status: dto.status ? 1 : 0 }),
            ...(dto.user_type !== undefined && { user_type: Number(dto.user_type) }),
            ...(dto.photo !== undefined && { photo: dto.photo }),
            ...(hashedPassword && { password: hashedPassword }),
          },
        });

        await tx.userInfo.upsert({
          where: { user_id: id },
          create: {
            user_id: id,
            first_name: dto.first_name,
            middle_name: dto.middle_name,
            last_name: dto.last_name,
            photo: dto.photo,
            dob: dto.dob ? new Date(dto.dob) : null,
            religion_id: dto.religion_id,
            gender: dto.gender,
            occupation: dto.occupation,
            nationality_id: dto.nationality_id,
            vulnerability_info: dto.vulnerability_info,
            pre_country: dto.pre_country,
            pre_srteet_address: dto.pre_srteet_address,
            pre_city: dto.pre_city,
            pre_provience: dto.pre_provience,
            pre_zip: dto.pre_zip,
            same_as_present_address:
              dto.same_as_present_address !== undefined
                ? dto.same_as_present_address
                  ? 1
                  : 0
                : 1,
            per_country: dto.per_country,
            per_srteet_address: dto.per_srteet_address,
            per_city: dto.per_city,
            per_provience: dto.per_provience,
            per_zip: dto.per_zip,
          },
          update: {
            ...(dto.first_name !== undefined && { first_name: dto.first_name }),
            ...(dto.middle_name !== undefined && { middle_name: dto.middle_name }),
            ...(dto.last_name !== undefined && { last_name: dto.last_name }),
            ...(dto.photo !== undefined && { photo: dto.photo }),
            ...(dto.dob !== undefined && { dob: dto.dob ? new Date(dto.dob) : null }),
            ...(dto.religion_id !== undefined && { religion_id: dto.religion_id }),
            ...(dto.gender !== undefined && { gender: dto.gender }),
            ...(dto.occupation !== undefined && { occupation: dto.occupation }),
            ...(dto.nationality_id !== undefined && { nationality_id: dto.nationality_id }),
            ...(dto.vulnerability_info !== undefined && { vulnerability_info: dto.vulnerability_info }),
            ...(dto.pre_country !== undefined && { pre_country: dto.pre_country }),
            ...(dto.pre_srteet_address !== undefined && { pre_srteet_address: dto.pre_srteet_address }),
            ...(dto.pre_city !== undefined && { pre_city: dto.pre_city }),
            ...(dto.pre_provience !== undefined && { pre_provience: dto.pre_provience }),
            ...(dto.pre_zip !== undefined && { pre_zip: dto.pre_zip }),
            ...(dto.same_as_present_address !== undefined && {
              same_as_present_address: dto.same_as_present_address ? 1 : 0,
            }),
            ...(dto.per_country !== undefined && { per_country: dto.per_country }),
            ...(dto.per_srteet_address !== undefined && { per_srteet_address: dto.per_srteet_address }),
            ...(dto.per_city !== undefined && { per_city: dto.per_city }),
            ...(dto.per_provience !== undefined && { per_provience: dto.per_provience }),
            ...(dto.per_zip !== undefined && { per_zip: dto.per_zip }),
          },
        });

        return tx.user.findFirst({
          where: { id },
          include: { userInfo: true, role: true },
        });
      });

      return {
        status: true,
        message: ApiMessages.UPDATE,
        data: this.sanitizeUser(updated),
      };
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException({
        status: false,
        message: error.message || ApiMessages.FAILUPDATE,
      });
    }
  }

  async destroy(id: number): Promise<ApiResponse> {
    const user = await this.prisma.user.findFirst({ where: { id } });
    if (!user) {
      throw new NotFoundException({
        status: false,
        message: ApiMessages.NODATA,
      });
    }

    await this.prisma.$transaction([
      this.prisma.userInfo.updateMany({
        where: { user_id: id },
        data: { deleted_at: new Date() },
      }),
      this.prisma.user.update({
        where: { id },
        data: { status: 0 },
      }),
    ]);

    return {
      status: true,
      message: ApiMessages.DESTROY,
      data: null,
    };
  }

  async restore(id: number): Promise<ApiResponse> {
    const user = await this.prisma.user.findFirst({ where: { id } });
    if (!user) {
      throw new NotFoundException({
        status: false,
        message: ApiMessages.NODATA,
      });
    }

    await this.prisma.$transaction([
      this.prisma.userInfo.updateMany({
        where: { user_id: id },
        data: { deleted_at: null },
      }),
      this.prisma.user.update({
        where: { id },
        data: { status: 1 },
      }),
    ]);

    const restored = await this.prisma.user.findFirst({
      where: { id },
      include: { userInfo: true, role: true },
    });

    return {
      status: true,
      message: ApiMessages.RESTORE,
      data: this.sanitizeUser(restored),
    };
  }
}
