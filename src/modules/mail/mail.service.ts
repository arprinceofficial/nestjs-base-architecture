import {
    Injectable,
    Logger,
    InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as nodemailer from 'nodemailer';
import { MongoLoggerService } from '@/modules/logger/mongo-logger.service';
import { TemplateService } from '@/modules/template/template.service';

export interface SendMailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    metadata?: Record<string, any>;
}

export interface SendTemplateMailOptions {
    to: string;
    subject: string;
    template: string; // e.g. 'otp' or 'emails/welcome'
    context?: Record<string, any>;
    text?: string;
    layout?: string | boolean;
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
     * Sends an email via SMTP if enabled.
     * Logs every email to MongoDB ('email_logs' collection) whether successful, failed, or skipped.
     */
    async sendMail(
        options: SendMailOptions,
    ): Promise<{ sent: boolean; messageId?: string; skipped?: boolean }> {
        const fromAddress =
            this.configService.get<string>('SMTP_FROM') ||
            'noreply@example.com';
        const fromName =
            this.configService.get<string>('SMTP_FROM_NAME') ||
            'NestJS Basement';
        const fullFrom = `"${fromName}" <${fromAddress}>`;
        const mailId = `MAIL-${randomUUID().substring(0, 8).toUpperCase()}`;

        // 1. If SMTP is disabled: record as 'skipped' in MongoDB and exit
        if (!this.isSmtpEnabled()) {
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

            // 2. If SMTP succeeded: record as 'success' in MongoDB
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

            // 3. If SMTP failed: record as 'error' in MongoDB
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
     * Helper to dispatch templated emails using the template engine.
     */
    async sendTemplateMail(
        options: SendTemplateMailOptions,
    ): Promise<{ sent: boolean; messageId?: string; skipped?: boolean }> {
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
            metadata: options.metadata,
        });
    }

    /**
     * Helper to dispatch password reset OTP emails using the email template engine.
     */
    async sendOtpEmail(
        email: string,
        otp: string,
        userName?: string,
    ): Promise<void> {
        const html = await this.templateService.renderEmail('otp', {
            email,
            otp,
            userName,
            expiryMinutes: 10,
            title: 'Password Reset OTP',
            preheader: 'Your one-time password for password reset',
        });

        await this.sendMail({
            to: email,
            subject: 'Your Password Reset OTP',
            text: `Your password reset OTP is: ${otp}. It will expire in 10 minutes.`,
            html,
            metadata: { action: 'forgot_password_otp', email },
        });
    }
}
