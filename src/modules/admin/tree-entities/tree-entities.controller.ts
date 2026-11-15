import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TreeEntitiesService } from './tree-entities.service';
import { CreateTreeEntityDto } from './dto/create-tree-entity.dto';
import { UpdateTreeEntityDto } from './dto/update-tree-entity.dto';
import { DeleteMenuDto } from './dto/delete-menu.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

@ApiTags('Admin - Menu Setup (Tree Entity)')
@Controller('tree-entity')
export class TreeEntitiesController {
  constructor(private readonly treeEntitiesService: TreeEntitiesService) {}

  @Get('build-menu')
  @ApiOperation({ summary: 'Build hierarchical menu structure for admin' })
  buildMenu() {
    return this.treeEntitiesService.buildMenu();
  }

  @Post('main-menu')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get main navigation menu for user role with permissions' })
  mainMenu(@Body('role_id') roleId?: number) {
    return this.treeEntitiesService.getMainMenu(roleId || 1);
  }

  @Get('main-menu')
  @ApiOperation({ summary: 'Get main navigation menu for user role (GET version)' })
  mainMenuGet(@Query('role_id') roleId?: number) {
    return this.treeEntitiesService.getMainMenu(roleId || 1);
  }

  @Post('update-menu')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Update menu structure hierarchy and ordering' })
  updateMenu(@Body() body: any) {
    return this.treeEntitiesService.updateMenu(body);
  }

  @Post('delete-menu')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Deactivate / reactivate a menu node and all its children' })
  deleteMenu(@Body() dto: DeleteMenuDto) {
    return this.treeEntitiesService.deleteMenu(dto);
  }

  @Post('restore/:id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Restore a soft-deleted menu entity by ID' })
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.treeEntitiesService.restore(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tree entities (supports pagination, search, status)' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.treeEntitiesService.findAll(query);
  }

  @Post('all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all tree entities via POST (Laravel compatibility)' })
  findAllPost(@Body() query: PaginationQueryDto) {
    return this.treeEntitiesService.findAll(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new tree entity' })
  create(@Body() dto: CreateTreeEntityDto) {
    return this.treeEntitiesService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific tree entity by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.treeEntitiesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a tree entity by ID' })
  updatePut(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTreeEntityDto) {
    return this.treeEntitiesService.update(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a tree entity by ID' })
  updatePatch(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTreeEntityDto) {
    return this.treeEntitiesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a tree entity by ID' })
  destroy(@Param('id', ParseIntPipe) id: number) {
    return this.treeEntitiesService.destroy(id);
  }
}
