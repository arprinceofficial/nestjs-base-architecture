import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ErrorLog, ErrorLogDocument } from './schemas/error-log.schema';

export interface CreateErrorLogParams {
  error_id: string;
  level?: string;
  status_code: number;
  message: string;
  error_name?: string;
  stack?: string;
  path: string;
  method: string;
  ip?: string;
  user_agent?: string;
  user_id?: number;
  user_email?: string;
  query?: Record<string, any>;
  params?: Record<string, any>;
  body?: Record<string, any>;
  headers?: Record<string, any>;
}

@Injectable()
export class MongoLoggerService {
  private readonly fallbackLogger = new Logger('MongoLogger');
  private static readonly SENSITIVE_KEYS = new Set([
    'password',
    'password_confirmation',
    'confirm_password',
    'token',
    'refresh_token',
    'authorization',
    'auth_code',
    'otp',
    'secret',
    'credit_card',
  ]);

  constructor(
    @InjectModel(ErrorLog.name)
    private readonly errorLogModel: Model<ErrorLogDocument>,
  ) {}

  /**
   * Sanitizes payloads to avoid storing sensitive information like passwords and tokens in logs.
   */
  public sanitize(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }

    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (MongoLoggerService.SENSITIVE_KEYS.has(key.toLowerCase())) {
        clean[key] = '****** [REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        clean[key] = this.sanitize(value);
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }

  /**
   * Persists an error log to MongoDB. Falls back to console logger if MongoDB operation fails.
   */
  async logError(params: CreateErrorLogParams): Promise<void> {
    try {
      const sanitizedBody = this.sanitize(params.body);
      const sanitizedHeaders = this.sanitize(params.headers);

      await this.errorLogModel.create({
        ...params,
        body: sanitizedBody,
        headers: sanitizedHeaders,
        created_at: new Date(),
      });
    } catch (err: any) {
      // Graceful fallback: never crash the HTTP request if logging fails
      this.fallbackLogger.error(
        `Failed to save error log to MongoDB [${params.error_id}]: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Retrieve error logs for administration or auditing.
   */
  async getErrorLogs(filter: {
    status_code?: number;
    user_id?: number;
    error_id?: string;
    limit?: number;
    skip?: number;
  }) {
    const query: Record<string, any> = {};
    if (filter.status_code) query.status_code = filter.status_code;
    if (filter.user_id) query.user_id = filter.user_id;
    if (filter.error_id) query.error_id = filter.error_id;

    const limit = filter.limit || 50;
    const skip = filter.skip || 0;

    return this.errorLogModel
      .find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
  }
}
