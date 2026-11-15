import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { RolePermissionsController } from './role-permissions.controller';

@Module({
  controllers: [RolesController, RolePermissionsController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
