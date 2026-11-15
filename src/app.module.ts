import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RouterModule } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './modules/logger/logger.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/admin/auth/auth.module';
import { RolesModule } from './modules/admin/roles/roles.module';
import { TreeEntitiesModule } from './modules/admin/tree-entities/tree-entities.module';
import { UsersModule } from './modules/admin/users/users.module';
import { CmsModule } from './modules/cms/cms.module';
import { CustomerModule } from './modules/customer/customer.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ||
          'mongodb://localhost:27017/nestjs_basement_logs',
      }),
    }),
    LoggerModule,
    PrismaModule,
    AdminModule,
    CmsModule,
    CustomerModule,
    RouterModule.register([
      {
        path: 'admin',
        module: AdminModule,
        children: [
          AuthModule,
          RolesModule,
          TreeEntitiesModule,
          UsersModule,
        ],
      },
      {
        path: 'cms',
        module: CmsModule,
      },
      {
        path: 'customer',
        module: CustomerModule,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
