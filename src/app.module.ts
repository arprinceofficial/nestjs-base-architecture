import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { RouterModule } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './modules/logger/logger.module';
import { MailModule } from './modules/mail/mail.module';
import { TemplateModule } from './modules/template/template.module';
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
        BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                connection: {
                    host: config.get<string>('REDIS_HOST') || '127.0.0.1',
                    port: Number(config.get<number>('REDIS_PORT')) || 6379,
                    password: config.get<string>('REDIS_PASSWORD') || undefined,
                    db: Number(config.get<number>('REDIS_DB')) || 0,
                },
            }),
        }),
        LoggerModule.register(),
        TemplateModule,
        MailModule,
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
