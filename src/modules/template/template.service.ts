import {
    Injectable,
    Logger,
    OnModuleInit,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as Handlebars from 'handlebars';

export interface RenderOptions {
    /**
     * Layout template relative to templates directory (e.g., 'emails/layout').
     * Pass false or null to disable layout wrapping.
     */
    layout?: string | boolean | null;
}

@Injectable()
export class TemplateService implements OnModuleInit {
    private readonly logger = new Logger(TemplateService.name);
    private baseDir: string;
    private readonly templateCache = new Map<
        string,
        Handlebars.TemplateDelegate
    >();
    private readonly hbs = Handlebars.create();

    constructor(private readonly configService: ConfigService) {
        this.baseDir = this.resolveBaseDir();
    }

    onModuleInit() {
        this.registerDefaultHelpers();
        this.logger.log(
            `TemplateService initialized with base directory: ${this.baseDir}`,
        );
    }

    /**
     * Resolves the templates directory across development (ts-node) and production (dist).
     */
    private resolveBaseDir(): string {
        const candidates = [
            path.resolve(process.cwd(), 'src/templates'),
            path.resolve(process.cwd(), 'dist/src/templates'),
            path.resolve(__dirname, '../../templates'),
            path.resolve(__dirname, '../templates'),
            path.resolve(process.cwd(), 'templates'),
        ];

        for (const dir of candidates) {
            try {
                const stats = require('fs').statSync(dir);
                if (stats.isDirectory()) {
                    return dir;
                }
            } catch {
                // Continue checking candidates
            }
        }

        // Default fallback
        return path.resolve(process.cwd(), 'src/templates');
    }

    /**
     * Registers global Handlebars helpers.
     */
    private registerDefaultHelpers(): void {
        this.hbs.registerHelper('eq', (a, b) => a === b);
        this.hbs.registerHelper('ne', (a, b) => a !== b);
        this.hbs.registerHelper('uppercase', (str) =>
            str ? String(str).toUpperCase() : '',
        );
        this.hbs.registerHelper('lowercase', (str) =>
            str ? String(str).toLowerCase() : '',
        );
        this.hbs.registerHelper('year', () => new Date().getFullYear());
        this.hbs.registerHelper('appName', () => this.getAppName());
        this.hbs.registerHelper(
            'formatDate',
            (date: Date | string | number) => {
                if (!date) return '';
                const d = new Date(date);
                return d.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                });
            },
        );
    }

    private getAppName(): string {
        return (
            this.configService.get<string>('APP_NAME') || 'NestJS Application'
        );
    }

    private getSupportEmail(): string {
        return (
            this.configService.get<string>('SUPPORT_EMAIL') ||
            this.configService.get<string>('SMTP_FROM') ||
            'support@example.com'
        );
    }

    /**
     * Reads and compiles a Handlebars template file.
     * In production, compiled delegates are cached in memory.
     */
    private async getCompiledTemplate(
        templatePath: string,
    ): Promise<Handlebars.TemplateDelegate> {
        const normalizedName = templatePath.endsWith('.hbs')
            ? templatePath
            : `${templatePath}.hbs`;
        const isProduction =
            this.configService.get<string>('NODE_ENV') === 'production';

        if (isProduction && this.templateCache.has(normalizedName)) {
            return this.templateCache.get(normalizedName)!;
        }

        const fullPath = path.resolve(this.baseDir, normalizedName);
        let source: string;
        try {
            source = await fs.readFile(fullPath, 'utf-8');
        } catch (err: any) {
            this.logger.error(`Template not found: ${fullPath}`);
            throw new NotFoundException(
                `Template '${templatePath}' could not be found at ${fullPath}`,
            );
        }

        const compiled = this.hbs.compile(source);
        if (isProduction) {
            this.templateCache.set(normalizedName, compiled);
        }
        return compiled;
    }

    /**
     * General template rendering method.
     *
     * @param templatePath Relative path inside templates dir (e.g. 'emails/otp', 'reports/sample-report')
     * @param data Context variables for the template
     * @param options Render options (e.g., layout wrapping)
     */
    async render(
        templatePath: string,
        data: Record<string, any> = {},
        options: RenderOptions = {},
    ): Promise<string> {
        const defaultContext = {
            appName: this.getAppName(),
            supportEmail: this.getSupportEmail(),
            year: new Date().getFullYear(),
            now: new Date().toISOString(),
        };

        const mergedData = { ...defaultContext, ...data };
        const compiledTemplate = await this.getCompiledTemplate(templatePath);
        const bodyContent = compiledTemplate(mergedData);

        // If layout is specified, wrap content into layout
        if (options.layout && typeof options.layout === 'string') {
            const compiledLayout = await this.getCompiledTemplate(
                options.layout,
            );
            return compiledLayout({
                ...mergedData,
                content: bodyContent,
            });
        }

        return bodyContent;
    }

    /**
     * Helper to render an email template wrapped in the standard email layout.
     *
     * @param templateName Name inside 'emails/' directory (e.g. 'otp')
     * @param data Context data
     * @param layout Optional layout override (defaults to 'emails/layout', or pass false for no layout)
     */
    async renderEmail(
        templateName: string,
        data: Record<string, any> = {},
        layout: string | boolean = 'emails/layout',
    ): Promise<string> {
        const templatePath = templateName.startsWith('emails/')
            ? templateName
            : `emails/${templateName}`;
        return this.render(templatePath, data, { layout });
    }

    /**
     * Helper to render a report template (e.g. for PDF generation or HTML export).
     *
     * @param reportName Name inside 'reports/' directory (e.g. 'sample-report')
     * @param data Context data
     */
    async renderReport(
        reportName: string,
        data: Record<string, any> = {},
    ): Promise<string> {
        const templatePath = reportName.startsWith('reports/')
            ? reportName
            : `reports/${reportName}`;
        return this.render(templatePath, data, { layout: false });
    }
}
