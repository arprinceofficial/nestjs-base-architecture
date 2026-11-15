import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTreeEntityDto } from './dto/create-tree-entity.dto';
import { UpdateTreeEntityDto } from './dto/update-tree-entity.dto';
import { DeleteMenuDto } from './dto/delete-menu.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { parseJsonArray, MenuTreeNode } from '../../common/utils/helper.util';
import { ApiMessages } from '../../common/constants/api-messages.constant';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class TreeEntitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto): Promise<ApiResponse> {
    const where: Prisma.TreeEntityWhereInput = {};

    if (query.trashed === 'with') {
      // include deleted
    } else if (query.trashed === 'only') {
      where.deleted_at = { not: null };
    } else {
      where.deleted_at = null;
    }

    if (query.search) {
      where.node_name = {
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
        this.prisma.treeEntity.findMany({
          where,
          orderBy: { serials: 'asc' },
          skip,
          take: limit,
        }),
        this.prisma.treeEntity.count({ where }),
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

    const data = await this.prisma.treeEntity.findMany({
      where,
      orderBy: { serials: 'asc' },
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

  async buildMenu(): Promise<ApiResponse> {
    const allNodes = await this.prisma.treeEntity.findMany({
      where: { deleted_at: null },
      orderBy: { serials: 'asc' },
      select: {
        id: true,
        node_name: true,
        pid: true,
        route_name: true,
        route_location: true,
        serials: true,
        status: true,
        icon: true,
      },
    });

    const buildTree = (parentId: number = 0): any[] => {
      return allNodes
        .filter((node) => (node.pid || 0) === parentId)
        .map((node) => ({
          ...node,
          pid: node.pid || 0,
          menus: buildTree(node.id),
        }));
    };

    const tree = buildTree(0);

    return {
      status: true,
      message: ApiMessages.GETALL,
      data: {
        data: tree,
        permissions: {},
      },
    };
  }

  async getMainMenu(roleId: number = 1): Promise<ApiResponse> {
    const query = Prisma.sql`
      SELECT
        te."id",
        te."pid",
        te."node_name" AS "name",
        te."route_name" AS "route",
        te."route_location",
        te."icon" AS "icon",
        t1."view",
        t1."add",
        t1."edit",
        t1."delete",
        false AS "showChild",
        false AS "is_open"
      FROM "tree_entities" te
      JOIN (
        SELECT "view", "add", "edit", "delete"
        FROM "role_permissions"
        WHERE "role_id" = ${roleId} AND "deleted_at" IS NULL
      ) t1 ON te."id" = t1."view"
      WHERE te."status" = 1 AND te."deleted_at" IS NULL
      ORDER BY te."serials" ASC
    `;

    const nodes: any[] = await this.prisma.$queryRaw(query);

    const buildHierarchy = (parentId: number = 0): any[] => {
      return nodes
        .filter((node) => (node.pid || 0) === parentId)
        .map((node) => ({
          ...node,
          pid: node.pid || 0,
          child: buildHierarchy(node.id),
        }));
    };

    const tree = buildHierarchy(0);

    return {
      status: true,
      message: ApiMessages.GETALL,
      data: tree,
    };
  }

  async updateMenu(body: any): Promise<ApiResponse> {
    try {
      let rawArray: MenuTreeNode[] = [];
      if (Array.isArray(body)) {
        rawArray = body;
      } else if (body?.data && Array.isArray(body.data)) {
        rawArray = body.data;
      } else if (body?.menus && Array.isArray(body.menus)) {
        rawArray = body.menus;
      } else if (typeof body === 'object' && body !== null) {
        const first = Object.values(body)[0];
        if (Array.isArray(first)) {
          rawArray = first;
        }
      }

      const flatList = parseJsonArray(rawArray, 0);

      await this.prisma.$transaction(async (tx) => {
        let serial = 0;
        for (const item of flatList) {
          serial++;
          await tx.treeEntity.update({
            where: { id: item.id },
            data: {
              pid: item.pid && item.pid > 0 ? item.pid : null,
              serials: serial,
            },
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

  async deleteMenu(dto: DeleteMenuDto): Promise<ApiResponse> {
    const success = await this.recursiveStatusUpdate(dto.id, dto.status);
    if (!success) {
      throw new NotFoundException({
        status: false,
        message: ApiMessages.FAILUPDATE,
      });
    }

    return {
      status: true,
      message: ApiMessages.UPDATE,
      data: null,
    };
  }

  private async recursiveStatusUpdate(id: number, status: number): Promise<boolean> {
    const children = await this.prisma.treeEntity.findMany({ where: { pid: id } });
    for (const child of children) {
      await this.recursiveStatusUpdate(child.id, status);
    }

    const node = await this.prisma.treeEntity.findFirst({ where: { id } });
    if (!node) {
      return false;
    }

    await this.prisma.treeEntity.update({
      where: { id },
      data: { status },
    });
    return true;
  }

  async findOne(id: number): Promise<ApiResponse> {
    const entity = await this.prisma.treeEntity.findFirst({
      where: { id, deleted_at: null },
    });

    if (!entity) {
      throw new NotFoundException({
        status: false,
        message: ApiMessages.NODATA,
      });
    }

    return {
      status: true,
      message: ApiMessages.SHOW,
      data: entity,
    };
  }

  async create(dto: CreateTreeEntityDto): Promise<ApiResponse> {
    const existing = await this.prisma.treeEntity.findFirst({
      where: { node_name: dto.node_name },
    });

    if (existing) {
      throw new BadRequestException({
        status: false,
        message: `Tree entity with name '${dto.node_name}' already exists.`,
      });
    }

    const entity = await this.prisma.treeEntity.create({
      data: {
        pid: dto.pid && dto.pid > 0 ? dto.pid : null,
        node_name: dto.node_name,
        route_name: dto.route_name,
        route_location: dto.route_location,
        icon: dto.icon,
        status: dto.status !== undefined ? (dto.status ? 1 : 0) : 1,
        serials: dto.serials,
      },
    });

    return {
      status: true,
      message: ApiMessages.STORE,
      data: entity,
    };
  }

  async update(id: number, dto: UpdateTreeEntityDto): Promise<ApiResponse> {
    const entity = await this.prisma.treeEntity.findFirst({
      where: { id, deleted_at: null },
    });

    if (!entity) {
      throw new NotFoundException({
        status: false,
        message: ApiMessages.NODATA,
      });
    }

    if (dto.node_name && dto.node_name !== entity.node_name) {
      const existing = await this.prisma.treeEntity.findFirst({
        where: { node_name: dto.node_name },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException({
          status: false,
          message: `Tree entity with name '${dto.node_name}' already exists.`,
        });
      }
    }

    const updated = await this.prisma.treeEntity.update({
      where: { id },
      data: {
        ...(dto.pid !== undefined && { pid: dto.pid && dto.pid > 0 ? dto.pid : null }),
        ...(dto.node_name !== undefined && { node_name: dto.node_name }),
        ...(dto.route_name !== undefined && { route_name: dto.route_name }),
        ...(dto.route_location !== undefined && { route_location: dto.route_location }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.status !== undefined && { status: dto.status ? 1 : 0 }),
        ...(dto.serials !== undefined && { serials: dto.serials }),
      },
    });

    return {
      status: true,
      message: ApiMessages.UPDATE,
      data: updated,
    };
  }

  async destroy(id: number): Promise<ApiResponse> {
    const entity = await this.prisma.treeEntity.findFirst({
      where: { id, deleted_at: null },
    });

    if (!entity) {
      throw new NotFoundException({
        status: false,
        message: ApiMessages.NODATA,
      });
    }

    await this.prisma.treeEntity.update({
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
    const entity = await this.prisma.treeEntity.findFirst({
      where: { id },
    });

    if (!entity) {
      throw new NotFoundException({
        status: false,
        message: ApiMessages.NODATA,
      });
    }

    const restored = await this.prisma.treeEntity.update({
      where: { id },
      data: { deleted_at: null },
    });

    return {
      status: true,
      message: ApiMessages.RESTORE,
      data: restored,
    };
  }
}
