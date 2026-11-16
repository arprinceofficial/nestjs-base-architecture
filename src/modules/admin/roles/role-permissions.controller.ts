import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@ApiTags('Admin - Role Permissions')
@Controller('role-permissions')
export class RolePermissionsController {
    constructor(private readonly rolesService: RolesService) {}

    @Get('show/:id')
    @ApiOperation({ summary: 'Get permissions matrix for a role' })
    showGet(@Param('id', ParseIntPipe) id: number) {
        return this.rolesService.showPermissions(id);
    }

    @Post('show/:id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get permissions matrix for a role (POST compatibility)',
    })
    showPost(@Param('id', ParseIntPipe) id: number) {
        return this.rolesService.showPermissions(id);
    }

    @Post('permission-update/:id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update permissions for a role' })
    updatePermissions(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: any,
    ) {
        return this.rolesService.updatePermissions(id, body);
    }
}
