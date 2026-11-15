import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ApiMessages } from '../constants/api-messages.constant';
import { MongoLoggerService } from '@/modules/logger/mongo-logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly mongoLogger?: MongoLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = ApiMessages.ERROR;
    let errors: any = null;
    let errorName = 'InternalServerError';
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      errorName = exception.name;
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resObj = exceptionResponse as any;
        message = resObj.message
          ? Array.isArray(resObj.message)
            ? resObj.message.join(', ')
            : resObj.message
          : exception.message;
        errors = resObj.errors || (Array.isArray(resObj.message) ? resObj.message : null);
      }
      stack = exception.stack;
    } else if (exception instanceof Error) {
      errorName = exception.name || 'Error';
      message = exception.message || ApiMessages.ERROR;
      stack = exception.stack;
      this.logger.error(exception.message, exception.stack);
    } else {
      message = String(exception);
    }

    // Generate unique error reference ID for tracing
    const errorId = `ERR-${randomUUID().substring(0, 8).toUpperCase()}`;

    // Extract user info if authenticated
    const user = (request as any)?.user;
    const userId = user?.id ? Number(user.id) : undefined;
    const userEmail = user?.email || undefined;

    // Asynchronously log full error context to MongoDB
    if (this.mongoLogger) {
      this.mongoLogger
        .logError({
          error_id: errorId,
          level: statusCode >= 500 ? 'fatal' : 'error',
          status_code: statusCode,
          message,
          error_name: errorName,
          stack,
          path: request.url,
          method: request.method,
          ip: request.ip || request.socket?.remoteAddress,
          user_agent: request.headers['user-agent'],
          user_id: userId,
          user_email: userEmail,
          query: request.query,
          params: request.params,
          body: request.body,
          headers: request.headers,
        })
        .catch((err) => {
          this.logger.error(`Error saving to MongoDB: ${err.message}`);
        });
    }

    const payload: Record<string, any> = {
      status: false,
      message,
      error_id: errorId,
    };

    if (errors) {
      payload.data = errors;
    }

    response.status(statusCode).json(payload);
  }
}
