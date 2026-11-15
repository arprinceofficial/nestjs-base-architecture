import { Module, DynamicModule, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ErrorLog, ErrorLogSchema } from './schemas/error-log.schema';
import { MailLog, MailLogSchema } from './schemas/mail-log.schema';
import { MongoLoggerService } from './mongo-logger.service';

@Global()
@Module({})
export class LoggerModule {
  static register(): DynamicModule {
    const mongoUri = process.env.MONGODB_URI?.trim();
    const imports = [];

    if (mongoUri) {
      imports.push(
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          { name: ErrorLog.name, schema: ErrorLogSchema },
          { name: MailLog.name, schema: MailLogSchema },
        ]),
      );
    }

    return {
      module: LoggerModule,
      global: true,
      imports,
      providers: [MongoLoggerService],
      exports: [MongoLoggerService],
    };
  }
}
