import { NestFactory } from '@nestjs/core';
import { ValidationPipe, ConsoleLogger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { MongoLoggerService } from './modules/logger/mongo-logger.service';

class CleanLogger extends ConsoleLogger {
    log(message: any, context?: string) {
        // Silence repetitive route mappings and instance loaders unless DEBUG_ROUTES=true
        if (
            process.env.DEBUG_ROUTES !== 'true' &&
            (context === 'RouterExplorer' ||
                context === 'RoutesResolver' ||
                context === 'InstanceLoader')
        ) {
            return;
        }
        super.log(message, context);
    }
}

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        logger: new CleanLogger(),
    });

    app.enableCors();

    app.setGlobalPrefix('api');

    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
        prefix: 'v',
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: false,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    const mongoLogger = app.get(MongoLoggerService);
    app.useGlobalFilters(new AllExceptionsFilter(mongoLogger));

    // Dynamic App Name from Environment
    const configService = app.get(ConfigService);
    const appName =
        configService.get<string>('APP_NAME') || 'NestJS Application';

    // Setup Swagger Documentation
    const swaggerConfig = new DocumentBuilder()
        .setTitle(`${appName} API`)
        .setDescription(
            `${appName} - REST API: User, Role, Role Permission, and Menu Setup (Tree Entity)`,
        )
        .setVersion('1.0')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`Application running on: http://localhost:${port}`);
    console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}

void bootstrap();
