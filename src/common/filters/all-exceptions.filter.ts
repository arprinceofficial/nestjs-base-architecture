import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiMessages } from '../constants/api-messages.constant';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = ApiMessages.ERROR;
    let errors: any = null;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
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
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      message = exception.message || ApiMessages.ERROR;
    }

    const payload: Record<string, any> = {
      status: false,
      message,
    };

    if (errors) {
      payload.data = errors;
    }

    response.status(statusCode).json(payload);
  }
}
