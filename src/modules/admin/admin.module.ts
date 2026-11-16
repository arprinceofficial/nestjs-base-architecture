import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { TreeEntitiesModule } from './tree-entities/tree-entities.module';
import { UsersModule } from './users/users.module';

@Module({
    imports: [AuthModule, RolesModule, TreeEntitiesModule, UsersModule],
    exports: [AuthModule, RolesModule, TreeEntitiesModule, UsersModule],
})
export class AdminModule {}
