#!/usr/bin/env node
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ConfigService } from '@nestjs/config';
import { MailDiagnosticsService } from '../src/modules/mail/mail-diagnostics.service';
import { PrismaService } from '../src/prisma/prisma.service';

function parseArgs() {
    const args = process.argv.slice(2);
    const options: {
        to?: string;
        timeout?: number;
        configOnly?: boolean;
        help?: boolean;
    } = {};

    for (const arg of args) {
        if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--config-only') {
            options.configOnly = true;
        } else if (arg.startsWith('--to=')) {
            options.to = arg.substring(5);
        } else if (arg === '-t' && args[args.indexOf(arg) + 1]) {
            options.to = args[args.indexOf(arg) + 1];
        } else if (arg.startsWith('--timeout=')) {
            options.timeout = parseInt(arg.substring(10), 10);
        }
    }

    return options;
}

function showHelp() {
    console.log(`
\x1b[1mUsage:\x1b[0m
  pnpm mail:test-server [options]
  ts-node scripts/mail-test-server.ts [options]

\x1b[1mDescription:\x1b[0m
  Check mail settings, DNS, outbound TCP, SMTP, TLS certificates and authentication;
  optionally send a live test email.

\x1b[1mOptions:\x1b[0m
  --to=<email>      Send one test email to this address after connection checks
  --timeout=<sec>   Timeout in seconds for each socket operation (1-60, default: 10)
  --config-only     Use .env configuration without checking database connectivity
  --help, -h        Display this help message

\x1b[1mExamples:\x1b[0m
  pnpm mail:test-server
  pnpm mail:test-server --to=user@example.com
  pnpm mail:test-server --config-only
`);
}

async function main() {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        process.exit(0);
    }

    const configService = new ConfigService();
    let prisma: PrismaService | undefined;

    if (!options.configOnly) {
        try {
            prisma = new PrismaService();
            await prisma.$connect();
        } catch {
            // Prisma optional if DB is offline or config-only
            prisma = undefined;
        }
    }

    const diagnosticsService = new MailDiagnosticsService(
        configService,
        prisma,
    );

    try {
        const result = await diagnosticsService.runDiagnostics({
            to: options.to,
            timeout: options.timeout,
            configOnly: options.configOnly,
        });

        if (prisma) {
            await prisma.$disconnect();
        }

        process.exit(result.success ? 0 : 1);
    } catch (err: any) {
        console.error(`\x1b[31m[FAIL] Execution error: ${err.message}\x1b[0m`);
        if (prisma) {
            await prisma.$disconnect();
        }
        process.exit(1);
    }
}

main();
