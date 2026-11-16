import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ErrorLog, ErrorLogDocument } from './schemas/error-log.schema';
import { EmailLog, EmailLogDocument } from './schemas/email-log.schema';

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

export interface CreateEmailLogParams {
    mail_id: string;
    to: string;
    from: string;
    subject: string;
    body_text?: string;
    body_html?: string;
    status: 'success' | 'error' | 'skipped';
    error?: string;
    smtp_response?: Record<string, any>;
    metadata?: Record<string, any>;
}

@Injectable()
export class MongoLoggerService {
    private readonly fallbackLogger = new Logger('AppLogger');
    private readonly logsDir = path.join(process.cwd(), 'logs');
    private readonly errorLogFilePath = path.join(
        process.cwd(),
        'logs',
        'errors.log',
    );
    private readonly mailLogFilePath = path.join(
        process.cwd(),
        'logs',
        'mail.log',
    );

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

        @Optional()
        @InjectModel(EmailLog.name)
        private readonly emailLogModel?: Model<EmailLogDocument>,
    ) {
        this.ensureLogsDirectory();
        if (!this.errorLogModel) {
            this.fallbackLogger.log(
                'MongoDB URI not configured. All application error & mail logs will default to local file storage at logs/',
            );
        }
    }

    private ensureLogsDirectory(): void {
        try {
            if (!fs.existsSync(this.logsDir)) {
                fs.mkdirSync(this.logsDir, { recursive: true });
            }
        } catch (e: any) {
            this.fallbackLogger.error(
                `Could not create logs directory: ${e.message}`,
            );
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
            fs.appendFileSync(this.errorLogFilePath, line, 'utf8');
        } catch (err: any) {
            this.fallbackLogger.error(
                `Failed to write to logs/errors.log: ${err.message}`,
            );
        }
    }

    /**
     * Persists an email log (success, error, or skipped) to MongoDB collection 'email_logs'.
     * Falls back to local logs/mail.log if MongoDB is not configured or offline.
     */
    async logEmail(params: CreateEmailLogParams): Promise<void> {
        // 1. If MongoDB model is available, write to MongoDB email_logs collection
        if (this.emailLogModel) {
            try {
                await this.emailLogModel.create({
                    ...params,
                    created_at: new Date(),
                });
                return;
            } catch (err: any) {
                this.fallbackLogger.warn(
                    `MongoDB write failed for mail log [${params.mail_id}]: ${err.message}. Falling back to local file log.`,
                );
            }
        }

        // 2. Default storage when MongoDB is not configured or fails: write to project logs/mail.log
        try {
            this.ensureLogsDirectory();
            const logRecord = {
                timestamp: new Date().toISOString(),
                ...params,
            };
            const line = JSON.stringify(logRecord) + '\n';
            fs.appendFileSync(this.mailLogFilePath, line, 'utf8');
        } catch (err: any) {
            this.fallbackLogger.error(
                `Failed to write to logs/mail.log: ${err.message}`,
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
        if (this.errorLogModel) {
            const query: Record<string, any> = {};
            if (filter.status_code) query.status_code = filter.status_code;
            if (filter.user_id) query.user_id = filter.user_id;
            if (filter.error_id) query.error_id = filter.error_id;

            return this.errorLogModel
                .find(query)
                .sort({ created_at: -1 })
                .skip(filter.skip || 0)
                .limit(filter.limit || 50)
                .lean()
                .exec();
        }

        try {
            if (!fs.existsSync(this.errorLogFilePath)) return [];
            const content = fs.readFileSync(this.errorLogFilePath, 'utf8');
            const lines = content.trim().split('\n').filter(Boolean);
            return lines
                .map((l) => JSON.parse(l))
                .reverse()
                .slice(0, filter.limit || 50);
        } catch {
            return [];
        }
    }

    /**
     * Retrieve email logs for administration or auditing.
     */
    async getEmailLogs(filter: {
        to?: string;
        status?: string;
        limit?: number;
        skip?: number;
    }) {
        if (this.emailLogModel) {
            const query: Record<string, any> = {};
            if (filter.to) query.to = filter.to;
            if (filter.status) query.status = filter.status;

            return this.emailLogModel
                .find(query)
                .sort({ created_at: -1 })
                .skip(filter.skip || 0)
                .limit(filter.limit || 50)
                .lean()
                .exec();
        }

        try {
            if (!fs.existsSync(this.mailLogFilePath)) return [];
            const content = fs.readFileSync(this.mailLogFilePath, 'utf8');
            const lines = content.trim().split('\n').filter(Boolean);
            return lines
                .map((l) => JSON.parse(l))
                .reverse()
                .slice(0, filter.limit || 50);
        } catch {
            return [];
        }
    }
}
