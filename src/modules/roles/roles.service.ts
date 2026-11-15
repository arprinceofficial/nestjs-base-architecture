import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiMessages } from '../../common/constants/api-messages.constant';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto): Promise<ApiResponse> {
    const where: Prisma.RoleWhereInput = {};

    if (query.trashed === 'with') {
      // include deleted
    } else if (query.trashed === 'only') {
      where.deleted_at = { not: null };
    } else {
      where.deleted_at = null;
    }

    if (query.search) {
      where.role_name = {
        contains: query.search,
        mode: 'insensitive',
      };
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
        this.prisma.role.findMany({
          where,
          orderBy: { role_name: 'asc' },
          skip,
          take: limit,
        }),
        this.prisma.role.count({ where }),
      ]);

      const lastPage = Math.ceil(total / limit);

      return {
        status: true,
        message: ApiMessages.GETALL,
        data: {
          data,
          total,
          current_page: page,
          per_page: limit,
          last_page: lastPage,
          permissions: {},
        },
      };
    }

    const data = await this.prisma.role.findMany({
      where,
      orderBy: { role_name: 'asc' },
    });

    return {
      status: true,
      message: ApiMessages.GETALL,
      data: {
        data,
        permissions: {},
      },
    };
  }

  async findOne(id: number): Promise<ApiResponse> {
    const role = await this.prisma.role.findFirst({
      where: { id, deleted_at: null },
    });

    if (!role) {
      throw new NotFoundException({
        status: false,
        message: ApiMessages.NODATA,
      });
    }

    return {
      status: true,
      message: ApiMessages.SHOW,
      data: role,
    };
  }

  async create(dto: CreateRoleDto): Promise<ApiResponse> {
    const existing = await this.prisma.role.findFirst({
      where: { role_name: dto.role_name },
    });

    if (existing) {
      throw new BadRequestException({
        status: false,
        message: `Role with name '${dto.role_name}' already exists.`,
      });
    }

    const role = await this.prisma.role.create({
      data: {
        role_name: dto.role_name,
        status: dto.status !== undefined ? (dto.status ? 1 : 0) : 1,
      },
    });

    return {
      status: true,
      message: ApiMessages.STORE,
      data: role,
    };
  }

  async update(id: number, dto: UpdateRoleDto): Promise<ApiResponse> {
    const role = await this.prisma.role.findFirst({
      where: { id, deleted_at: null },
    });

    if (!role) {
      throw new NotFoundException({
        status: false,
        message: ApiMessages.NODATA,
      });
    }

    if (dto.role_name && dto.role_name !== role.role_name) {
      const existing = await this.prisma.role.findFirst({
        where: { role_name: dto.role_name },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException({
          status: false,
          message: `Role with name '${dto.role_name}' already exists.`,
        });
      }
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.role_name !== undefined && { role_name: dto.role_name }),
        ...(dto.status !== undefined && { status: dto.status ? 1 : 0 }),
      },
    });

    return {
      status: true,
      message: ApiMessages.UPDATE,
      data: updated,
    };
  }

  async destroy(id: number): Promise<ApiResponse> {
    const role = await this.prisma.role.findFirst({
      where: { id, deleted_at: null },
    });

    if (!role) {
      throw new NotFoundException({
        status: false,
        message: ApiMessages.NODATA,
      });
    }

    await this.prisma.role.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    return {
      status: true,
      message: ApiMessages.DESTROY,
      data: null,
    };
  }

  async restore(id: number): Promise<ApiResponse> {
    const role = await this.prisma.role.findFirst({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException({
        status: false,
        message: ApiMessages.NODATA,
      });
    }

    const restored = await this.prisma.role.update({
      where: { id },
      data: { deleted_at: null },
    });

    return {
      status: true,
      message: ApiMessages.RESTORE,
      data: restored,
    };
  }

  async showPermissions(roleId: number): Promise<ApiResponse> {
    const query = Prisma.sql`
      SELECT
          "treeNode"."id",
          "treeNode"."pid",
          "treeNode"."node_name",
          CAST((SELECT COUNT(test."pid")
           FROM "tree_entities" AS test
           WHERE test."pid" = "treeNode"."id"
           AND test."node_name" <> '') AS INTEGER) AS "haschild",
          "treeNode"."id" AS "view",
          "treeNode"."id" AS "add",
          "treeNode"."id" AS "edit",
          "treeNode"."id" AS "delete",
          "per"."sid",
          COALESCE("per"."viewP", 0) AS "viewP",
          COALESCE("per"."addP", 0) AS "addP",
          COALESCE("per"."editP", 0) AS "editP",
          COALESCE("per"."deleteP", 0) AS "deleteP"
      FROM
          "tree_entities" AS "treeNode"
          LEFT JOIN (
              SELECT 
                     CASE 
                         WHEN "view" > 0 THEN "view"
                         WHEN "add" > 0 THEN "add"
                         WHEN "edit" > 0 THEN "edit"
                         WHEN "delete" > 0 THEN "delete"
                         ELSE 0 
                     END AS "sid",
                     COALESCE("view", 0) AS "viewP",
                     COALESCE("add", 0) AS "addP",
                     COALESCE("edit", 0) AS "editP",
                     COALESCE("delete", 0) AS "deleteP"
              FROM "role_permissions"
              WHERE "role_id" = ${roleId} AND "deleted_at" IS NULL
          ) AS "per" ON "per"."sid" = "treeNode"."id"
      WHERE "treeNode"."status" = 1 AND "treeNode"."deleted_at" IS NULL
      ORDER BY "treeNode"."serials" ASC
    `;

    const permissions = await this.prisma.$queryRaw(query);

    return {
      status: true,
      message: ApiMessages.SHOW,
      data: permissions,
    };
  }

  async updatePermissions(roleId: number, payload: any): Promise<ApiResponse> {
    try {
      let items: any[] = [];
      if (Array.isArray(payload)) {
        items = payload;
      } else if (payload?.permissions && Array.isArray(payload.permissions)) {
        items = payload.permissions;
      } else if (payload?.data && Array.isArray(payload.data)) {
        items = payload.data;
      } else if (typeof payload === 'object' && payload !== null) {
        const firstVal = Object.values(payload)[0];
        if (Array.isArray(firstVal)) {
          items = firstVal;
        }
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.rolePermission.deleteMany({
          where: { role_id: roleId },
        });

        const insertData = items
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            role_id: roleId,
            view: item.viewP || item.view || 0,
            add: item.addP || item.add || 0,
            edit: item.editP || item.edit || 0,
            delete: item.deleteP || item.delete || 0,
          }));

        if (insertData.length > 0) {
          await tx.rolePermission.createMany({
            data: insertData,
          });
        }
      });

      return {
        status: true,
        message: ApiMessages.UPDATE,
        data: null,
      };
    } catch (error: any) {
      throw new InternalServerErrorException({
        status: false,
        message: error.message || ApiMessages.FAILUPDATE,
      });
    }
  }
}
