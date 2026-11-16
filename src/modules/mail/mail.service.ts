import {
    Injectable,
    Logger,
    InternalServerErrorException,
    Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import * as nodemailer from 'nodemailer';
import { MongoLoggerService } from '@/modules/logger/mongo-logger.service';
import { TemplateService } from '@/modules/template/template.service';

export interface SendMailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    sync?: boolean; // Set to true to bypass BullMQ background queue
    metadata?: Record<string, any>;
}

export interface SendTemplateMailOptions {
    to: string;
    subject: string;
    template: string; // e.g. 'otp' or 'emails/welcome'
    context?: Record<string, any>;
    text?: string;
    layout?: string | boolean;
    sync?: boolean;
    metadata?: Record<string, any>;
}

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private transporter: nodemailer.Transporter | null = null;

    constructor(
        private readonly configService: ConfigService,
        private readonly mongoLoggerService: MongoLoggerService,
        private readonly templateService: TemplateService,

        @Optional()
        @InjectQueue('mail')
        private readonly mailQueue?: Queue,
    ) {
        this.initTransporter();
    }

    private isSmtpEnabled(): boolean {
        const val = this.configService.get<string>('SMTP_ENABLED');
        return val === 'true' || val === '1';
    }

    private initTransporter(): void {
        if (!this.isSmtpEnabled()) {
            this.logger.log(
                'SMTP is disabled (SMTP_ENABLED=false). Outgoing emails will not be dispatched.',
            );
            return;
        }

        const host =
            this.configService.get<string>('SMTP_HOST') || 'smtp.mailtrap.io';
        const port = Number(this.configService.get<number>('SMTP_PORT')) || 587;
        // In Nodemailer, secure: true is ONLY for port 465 (SMTPS direct SSL/TLS).
        // Ports 587, 2525, 25 negotiate TLS via STARTTLS, so secure MUST be false.
        const secureConfig = this.configService.get<string>('SMTP_SECURE');
        const secure =
            port === 465
                ? true
                : secureConfig === 'true' &&
                  port !== 587 &&
                  port !== 2525 &&
                  port !== 25;
        const user = this.configService.get<string>('SMTP_USER');
        const pass = this.configService.get<string>('SMTP_PASS');

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: user ? { user, pass } : undefined,
            tls: {
                rejectUnauthorized: false,
            },
        });
    }

    /**
     * Primary entry point to dispatch emails.
     * By default, enqueues the email into BullMQ for lightning-fast, non-blocking API performance.
     * Also records the 'waiting' queue event in MongoDB collection 'queue_logs'.
     */
    async sendMail(options: SendMailOptions): Promise<{
        sent: boolean;
        messageId?: string;
        skipped?: boolean;
        queued?: boolean;
    }> {
        // If SMTP is disabled: record as 'skipped' in MongoDB directly
        if (!this.isSmtpEnabled()) {
            const fromAddress =
                this.configService.get<string>('SMTP_FROM') ||
                'noreply@example.com';
            const fromName =
                this.configService.get<string>('SMTP_FROM_NAME') ||
                this.configService.get<string>('APP_NAME') ||
                'NestJS Application';
            const fullFrom = `"${fromName}" <${fromAddress}>`;
            const mailId = `MAIL-${randomUUID().substring(0, 8).toUpperCase()}`;

            this.logger.log(
                `[SMTP Disabled] Email to ${options.to} was not sent (stored in database).`,
            );
            await this.mongoLoggerService.logEmail({
                mail_id: mailId,
                to: options.to,
                from: fullFrom,
                subject: options.subject,
                body_text: options.text,
                body_html: options.html,
                status: 'skipped',
                metadata: options.metadata,
            });
            return { sent: false, skipped: true };
        }

        // Fast asynchronous path via BullMQ queue (unless sync: true requested)
        if (!options.sync && this.mailQueue) {
            try {
                const job = await this.mailQueue.add('send_mail', options, {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 3000,
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                });

                this.logger.log(
                    `Email to ${options.to} enqueued to BullMQ (Job ID: ${job.id})`,
                );

                // Log queue event in MongoDB queue_logs
                await this.mongoLoggerService.logQueueEvent({
                    queue_name: 'mail',
                    job_id: String(job.id),
                    job_name: 'send_mail',
                    event: 'waiting',
                    payload: options,
                });

                return { sent: true, queued: true, messageId: `JOB-${job.id}` };
            } catch (err: any) {
                this.logger.warn(
                    `BullMQ enqueue failed: ${err.message}. Falling back to direct dispatch.`,
                );
            }
        }

        // Direct/Synchronous dispatch fallback
        return this.sendDirect(options);
    }

    /**
     * Executes the actual SMTP network transmission and logs to MongoDB collection 'email_logs'.
     * Called in background by BullMQ MailProcessor (or directly when sync: true).
     */
    async sendDirect(
        options: SendMailOptions,
    ): Promise<{ sent: boolean; messageId?: string; skipped?: boolean }> {
        const fromAddress =
            this.configService.get<string>('SMTP_FROM') ||
            'noreply@example.com';
        const fromName =
            this.configService.get<string>('SMTP_FROM_NAME') ||
            this.configService.get<string>('APP_NAME') ||
            'NestJS Application';
        const fullFrom = `"${fromName}" <${fromAddress}>`;
        const mailId = `MAIL-${randomUUID().substring(0, 8).toUpperCase()}`;

        if (!this.transporter) {
            this.initTransporter();
        }

        try {
            const info = await this.transporter!.sendMail({
                from: fullFrom,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
            });

            this.logger.log(
                `Email dispatched to ${options.to} (Message ID: ${info.messageId})`,
            );

            // 1. If SMTP succeeded: record as 'success' in MongoDB email_logs
            await this.mongoLoggerService.logEmail({
                mail_id: info.messageId || mailId,
                to: options.to,
                from: fullFrom,
                subject: options.subject,
                body_text: options.text,
                body_html: options.html,
                status: 'success',
                smtp_response: {
                    messageId: info.messageId,
                    accepted: info.accepted,
                    response: info.response,
                },
                metadata: options.metadata,
            });

            return { sent: true, messageId: info.messageId };
        } catch (error: any) {
            this.logger.error(
                `Failed to send email to ${options.to}: ${error.message}`,
                error.stack,
            );

            // 2. If SMTP failed: record as 'error' in MongoDB email_logs
            await this.mongoLoggerService.logEmail({
                mail_id: mailId,
                to: options.to,
                from: fullFrom,
                subject: options.subject,
                body_text: options.text,
                body_html: options.html,
                status: 'error',
                error: error.message,
                metadata: options.metadata,
            });

            throw new InternalServerErrorException({
                status: false,
                message: `Failed to send email: ${error.message || 'SMTP connection error'}`,
            });
        }
    }

    /**
     * Helper to dispatch templated emails using the template engine and BullMQ queue.
     */
    async sendTemplateMail(options: SendTemplateMailOptions): Promise<{
        sent: boolean;
        messageId?: string;
        skipped?: boolean;
        queued?: boolean;
    }> {
        const layout =
            options.layout !== undefined ? options.layout : 'emails/layout';
        const html = await this.templateService.renderEmail(
            options.template,
            {
                title: options.subject,
                ...options.context,
            },
            layout,
        );

        return this.sendMail({
            to: options.to,
            subject: options.subject,
            text: options.text,
            html,
            sync: options.sync,
            metadata: options.metadata,
        });
    }

    /**
     * Helper to dispatch password reset OTP emails using the email template engine and BullMQ queue.
     */
    async sendOtpEmail(
        email: string,
        otp: string,
        userName?: string,
        sync?: boolean,
    ): Promise<void> {
        const appName =
            this.configService.get<string>('APP_NAME') || 'NestJS Base';
        const subject = `One Time Password (OTP) for ${appName}`;

        const html = await this.templateService.renderEmail('users/otp', {
            email,
            otp,
            userName,
            appName,
            expiryMinutes: 10,
            title: `One Time Password (OTP) - ${appName}`,
            preheader: `Your verification code is ${otp}. Use this code to complete verification.`,
        });

        const plainText = [
            `Your verification code is: ${otp}`,
            '',
            `Use this One-Time Password (OTP) to complete your verification for ${appName}. This code will expire in 10 minutes.`,
            '',
            `Never share this code with anyone. If you did not request this, you can safely ignore this email.`,
        ].join('\n');

        await this.sendMail({
            to: email,
            subject,
            text: plainText,
            html,
            sync,
            metadata: {
                action: 'forgot_password_otp',
                email,
                app_name: appName,
            },
        });
    }
}
