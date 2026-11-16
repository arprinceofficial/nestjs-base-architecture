import {
    Injectable,
    Logger,
    OnModuleInit,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
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
                const stats = fs.statSync(dir);
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
     * Resolves the full path of a template file, checking module views and global templates.
     * Supports:
     * - Module-level views (e.g. 'users/otp' -> 'src/modules/admin/users/views/otp.hbs')
     * - Direct path ('modules/admin/users/views/otp.hbs')
     * - Global templates ('emails/layout', 'reports/sample-report')
     * - Bare template names ('otp' -> checks feature views first)
     */
    private resolveTemplatePath(templatePath: string): string {
        const normalized = templatePath.endsWith('.hbs')
            ? templatePath
            : `${templatePath}.hbs`;

        const rootCandidates = [
            path.resolve(process.cwd(), 'src'),
            path.resolve(process.cwd(), 'dist/src'),
            path.resolve(process.cwd(), 'dist'),
            path.resolve(__dirname, '../../..'),
            path.resolve(__dirname, '../..'),
        ];

        const bareName = path.basename(normalized);
        const withoutPrefix = normalized.replace(
            /^(emails|templates|modules)\//,
            '',
        );

        const candidates: string[] = [
            // 1. Direct path inside baseDir
            path.resolve(this.baseDir, normalized),
            path.resolve(this.baseDir, withoutPrefix),
        ];

        // 2. Module-specific view paths
        for (const root of rootCandidates) {
            candidates.push(
                // Direct relative to root
                path.resolve(root, normalized),
                // Module views: src/modules/admin/users/views/otp.hbs
                path.resolve(root, 'modules/admin/users/views', bareName),
                path.resolve(root, 'modules/admin/auth/views', bareName),
                path.resolve(
                    root,
                    'modules/admin',
                    withoutPrefix.replace('/', '/views/'),
                ),
                path.resolve(
                    root,
                    'modules',
                    withoutPrefix.replace('/', '/views/'),
                ),
                // Global templates
                path.resolve(root, 'templates/emails', bareName),
                path.resolve(root, 'templates', normalized),
            );
        }

        for (const candidate of candidates) {
            try {
                if (
                    fs.existsSync(candidate) &&
                    fs.statSync(candidate).isFile()
                ) {
                    return candidate;
                }
            } catch {
                // Continue checking
            }
        }

        // Fallback default
        return path.resolve(this.baseDir, normalized);
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
        const isProduction =
            this.configService.get<string>('NODE_ENV') === 'production';

        if (isProduction && this.templateCache.has(templatePath)) {
            return this.templateCache.get(templatePath)!;
        }

        const fullPath = this.resolveTemplatePath(templatePath);
        let source: string;
        try {
            source = await fsp.readFile(fullPath, 'utf-8');
        } catch (err: any) {
            this.logger.error(`Template not found: ${fullPath}`);
            throw new NotFoundException(
                `Template '${templatePath}' could not be found at ${fullPath}`,
            );
        }

        const compiled = this.hbs.compile(source);
        if (isProduction) {
            this.templateCache.set(templatePath, compiled);
        }
        return compiled;
    }

    /**
     * General template rendering method.
     *
     * @param templatePath Relative path inside templates dir or module views
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
     * Searches both feature module views (e.g. 'users/otp') and global 'emails/' templates.
     *
     * @param templateName Name inside 'emails/' directory or module views (e.g. 'users/otp' or 'otp')
     * @param data Context data
     * @param layout Optional layout override (defaults to 'emails/layout', or pass false for no layout)
     */
    async renderEmail(
        templateName: string,
        data: Record<string, any> = {},
        layout: string | boolean = 'emails/layout',
    ): Promise<string> {
        const templatePath =
            templateName.startsWith('emails/') ||
            templateName.startsWith('modules/')
                ? templateName
                : templateName;
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
