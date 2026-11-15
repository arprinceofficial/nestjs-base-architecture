import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ErrorLog, ErrorLogSchema } from './schemas/error-log.schema';
import { MongoLoggerService } from './mongo-logger.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ErrorLog.name, schema: ErrorLogSchema },
    ]),
  ],
  providers: [MongoLoggerService],
  exports: [MongoLoggerService],
})
export class LoggerModule {}
