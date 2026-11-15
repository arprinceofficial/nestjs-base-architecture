import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger, Optional } from '@nestjs/common';
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
  private readonly fallbackLogger = new Logger('AppLogger');
  private readonly logsDir = path.join(process.cwd(), 'logs');
  private readonly logFilePath = path.join(process.cwd(), 'logs', 'errors.log');

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
    @Optional()
    @InjectModel(ErrorLog.name)
    private readonly errorLogModel?: Model<ErrorLogDocument>,
  ) {
    this.ensureLogsDirectory();
    if (!this.errorLogModel) {
      this.fallbackLogger.log(
        'MongoDB URI not configured. All application error logs will default to local file storage at logs/errors.log',
      );
    }
  }

  private ensureLogsDirectory(): void {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (e: any) {
      this.fallbackLogger.error(`Could not create logs directory: ${e.message}`);
    }
  }

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
   * Appends an error record to the local project logs/errors.log file.
   */
  private writeToFile(params: CreateErrorLogParams, sanitizedBody: any, sanitizedHeaders: any): void {
    try {
      this.ensureLogsDirectory();

      const logRecord = {
        timestamp: new Date().toISOString(),
        error_id: params.error_id,
        level: params.level || 'error',
        status_code: params.status_code,
        message: params.message,
        error_name: params.error_name,
        path: params.path,
        method: params.method,
        ip: params.ip,
        user_agent: params.user_agent,
        user_id: params.user_id,
        user_email: params.user_email,
        query: params.query,
        params: params.params,
        body: sanitizedBody,
        headers: sanitizedHeaders,
        stack: params.stack,
      };

      const line = JSON.stringify(logRecord) + '\n';
      fs.appendFileSync(this.logFilePath, line, 'utf8');
    } catch (err: any) {
      this.fallbackLogger.error(`Failed to write to logs/errors.log: ${err.message}`);
    }
  }

  /**
   * Persists an error log to MongoDB if configured, otherwise falls back to local file storage at logs/errors.log.
   */
  async logError(params: CreateErrorLogParams): Promise<void> {
    const sanitizedBody = this.sanitize(params.body);
    const sanitizedHeaders = this.sanitize(params.headers);

    // 1. If MongoDB model is available, attempt to write to MongoDB
    if (this.errorLogModel) {
      try {
        await this.errorLogModel.create({
          ...params,
          body: sanitizedBody,
          headers: sanitizedHeaders,
          created_at: new Date(),
        });
        return;
      } catch (err: any) {
        this.fallbackLogger.warn(
          `MongoDB write failed for [${params.error_id}]: ${err.message}. Falling back to local file log.`,
        );
      }
    }

    // 2. Default storage when MongoDB is not configured or fails: write to project logs/errors.log
    this.writeToFile(params, sanitizedBody, sanitizedHeaders);
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
    if (this.errorLogModel) {
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

    // If MongoDB is not configured, read from local file
    try {
      if (!fs.existsSync(this.logFilePath)) return [];
      const content = fs.readFileSync(this.logFilePath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.map((l) => JSON.parse(l)).reverse().slice(0, filter.limit || 50);
    } catch {
      return [];
    }
  }
}
