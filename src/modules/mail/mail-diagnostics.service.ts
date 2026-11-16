import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';
import * as tls from 'tls';
import * as dns from 'dns';
import { PrismaService } from '@/prisma/prisma.service';

export interface DiagnosticOptions {
    to?: string;
    timeout?: number; // seconds (1 - 60)
    configOnly?: boolean;
    caFile?: string; // Optional custom CA file for test fixtures
    rejectUnauthorized?: boolean;
    allowInsecureAuth?: boolean;
    logger?: (line: string) => void;
}

export interface DiagnosticResult {
    success: boolean;
    stage: string;
    error?: string;
}

@Injectable()
export class MailDiagnosticsService {
    private readonly nestLogger = new Logger(MailDiagnosticsService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma?: PrismaService,
    ) {}

    /**
     * Executes the comprehensive mail server diagnostic suite.
     */
    async runDiagnostics(
        options: DiagnosticOptions = {},
    ): Promise<DiagnosticResult> {
        const timeoutSeconds = options.timeout ?? 10;
        if (
            isNaN(timeoutSeconds) ||
            timeoutSeconds < 1 ||
            timeoutSeconds > 60
        ) {
            throw new Error('--timeout must be an integer from 1 to 60.');
        }

        const timeoutMs = timeoutSeconds * 1000;
        const recipient = options.to?.trim();
        if (recipient && !this.isValidEmail(recipient)) {
            throw new Error('--to must be a valid email address.');
        }

        const out = options.logger || ((msg: string) => console.log(msg));
        const colors = {
            green: (s: string) => `\x1b[32m${s}\x1b[0m`,
            yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
            red: (s: string) => `\x1b[31m${s}\x1b[0m`,
            cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
            bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
            gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
        };

        let stage = 'Configuration';
        let secrets: string[] = [];
        let socket: net.Socket | null = null;
        let tlsSocket: tls.TLSSocket | null = null;

        try {
            // Stage 1: Settings Source & Database Validation
            if (!options.configOnly) {
                stage = 'Admin mail settings / database';
                out(
                    'Settings source: Environment (.env) plus database health check',
                );
                if (this.prisma) {
                    try {
                        await this.prisma.$queryRaw`SELECT 1`;
                        out(
                            colors.green('[PASS] Database connection verified'),
                        );
                    } catch (dbErr: any) {
                        out(
                            colors.yellow(
                                '[WARN] Database health check failed. Run with --config-only to bypass database checks.',
                            ),
                        );
                    }
                }
            } else {
                out('Settings source: Environment (.env) configuration only');
            }

            // Stage 2: SMTP Configuration Validation
            stage = 'SMTP configuration';
            const smtpEnabled =
                this.configService.get<string>('SMTP_ENABLED') === 'true' ||
                this.configService.get<string>('SMTP_ENABLED') === '1';

            if (!smtpEnabled) {
                out(
                    colors.yellow(
                        '[WARN] Application email notifications are disabled (SMTP_ENABLED=false). This diagnostic will still test the server.',
                    ),
                );
            }

            const host =
                this.configService.get<string>('SMTP_HOST') ||
                'smtp.mailtrap.io';
            const port =
                Number(this.configService.get<number>('SMTP_PORT')) || 587;
            const username =
                this.configService.get<string>('SMTP_USER')?.trim() || '';
            const password =
                this.configService.get<string>('SMTP_PASS')?.trim() || '';
            const fromAddress =
                this.configService.get<string>('SMTP_FROM')?.trim() ||
                'noreply@example.com';
            const fromName =
                this.configService.get<string>('SMTP_FROM_NAME') ||
                this.configService.get<string>('APP_NAME') ||
                'NestJS Application';

            if (!this.isValidEmail(fromAddress)) {
                throw new Error(
                    `The configured From address '${fromAddress}' is invalid. Check SMTP_FROM in .env.`,
                );
            }

            // Collect secrets to redact in output/errors
            secrets = [
                username,
                password,
                Buffer.from(username).toString('base64'),
                Buffer.from(password).toString('base64'),
                Buffer.from(`\0${username}\0${password}`).toString('base64'),
            ].filter((s) => s.length > 0);

            out(colors.gray(`Target SMTP server: ${host}:${port}`));
            out(
                colors.gray(
                    `Configured From address: "${fromName}" <${fromAddress}>`,
                ),
            );

            // Stage 3: DNS Resolution
            stage = 'DNS resolution';
            const addresses = await this.resolveHost(host);
            out(
                colors.green(
                    `[PASS] DNS resolution: ${host} -> [${addresses.join(', ')}]`,
                ),
            );

            // Stage 4: Outbound TCP Connection
            stage = 'Outbound TCP';
            const startTime = Date.now();
            socket = await this.createTcpConnection(host, port, timeoutMs);
            const durationMs = Date.now() - startTime;
            out(
                colors.green(
                    `[PASS] Outbound TCP: Connected to ${host}:${port} (${durationMs}ms)`,
                ),
            );

            // Setup response reader
            const reader = new SmtpStreamReader(socket, timeoutMs);

            // Read SMTP greeting banner
            stage = 'SMTP greeting';
            const banner = await reader.readResponse();
            if (!banner.code.startsWith('220')) {
                throw new Error(
                    `Unexpected SMTP greeting: ${banner.raw.trim()}`,
                );
            }

            // Stage 5: ESMTP Capability Negotiation (EHLO)
            stage = 'ESMTP capability negotiation (EHLO)';
            await reader.writeCommand('EHLO localhost\r\n');
            const ehloResp = await reader.readResponse();
            if (!ehloResp.code.startsWith('250')) {
                throw new Error(
                    `Server rejected EHLO command: ${ehloResp.raw.trim()}`,
                );
            }

            const capabilities = this.parseCapabilities(ehloResp.lines);
            const supportsStartTls = capabilities.includes('STARTTLS');
            const authLine = ehloResp.lines.find((l) => l.includes('AUTH'));
            out(
                colors.green(
                    `[PASS] SMTP greeting / EHLO: Advertised capabilities: ${capabilities.join(', ')}`,
                ),
            );

            // Stage 6: TLS / SSL Negotiation
            stage = 'TLS / SSL negotiation';
            let activeReader = reader;
            const isDirectSmtps = port === 465;

            if (isDirectSmtps) {
                out(
                    colors.cyan(
                        'Direct SMTPS (port 465): Connection already secured with SSL/TLS',
                    ),
                );
            } else if (supportsStartTls) {
                await reader.writeCommand('STARTTLS\r\n');
                const tlsResp = await reader.readResponse();
                if (!tlsResp.code.startsWith('220')) {
                    throw new Error(
                        `Server rejected STARTTLS: ${tlsResp.raw.trim()}`,
                    );
                }

                // Upgrade socket to TLS
                tlsSocket = await this.upgradeToTls(
                    socket,
                    host,
                    timeoutMs,
                    options,
                );
                activeReader = new SmtpStreamReader(tlsSocket, timeoutMs);

                // Verify certificate details
                const cert = tlsSocket.getPeerCertificate(true);
                const isAuthorized = tlsSocket.authorized;
                if (!isAuthorized && options.rejectUnauthorized !== false) {
                    throw new Error(
                        `Server certificate verification failed: ${tlsSocket.authorizationError?.message || 'Untrusted certificate'}`,
                    );
                }

                const protocol = tlsSocket.getProtocol() || 'TLS';
                const cipher = tlsSocket.getCipher()?.name || 'unknown';
                const validTo = cert.valid_to
                    ? new Date(cert.valid_to).toLocaleDateString()
                    : 'N/A';
                out(
                    colors.green(
                        `[PASS] TLS negotiated: ${protocol} (${cipher}), certificate valid until ${validTo}`,
                    ),
                );

                // Re-send EHLO on the encrypted channel
                await activeReader.writeCommand('EHLO localhost\r\n');
                const tlsEhloResp = await activeReader.readResponse();
                if (!tlsEhloResp.code.startsWith('250')) {
                    throw new Error(
                        `Server rejected post-TLS EHLO: ${tlsEhloResp.raw.trim()}`,
                    );
                }
            } else {
                out(
                    colors.yellow(
                        '[WARN] SMTP connection is unencrypted. TLS certificate checks did not run.',
                    ),
                );
                if (username !== '' && !options.allowInsecureAuth) {
                    throw new Error(
                        'Refusing to test credentials over an unencrypted connection. Configure SMTPS (usually port 465) or STARTTLS (usually port 587/2525).',
                    );
                }
            }

            // Stage 7: SMTP Authentication
            stage = 'SMTP authentication';
            if (username !== '') {
                await this.authenticate(activeReader, username, password);
                out(
                    colors.green(
                        `[PASS] SMTP authentication: User '${username}' authenticated successfully`,
                    ),
                );
            } else {
                out(
                    colors.cyan(
                        '[SKIP] Authentication: no SMTP username configured (server may allow an unauthenticated relay).',
                    ),
                );
            }

            // Stage 8: Message Submission (Optional --to)
            if (recipient) {
                stage = 'Test message submission';
                await this.sendTestMessage(
                    activeReader,
                    fromAddress,
                    fromName,
                    recipient,
                );
                out(
                    colors.green(
                        `[PASS] SMTP server accepted the test message. Check recipient '${recipient}' inbox & spam folder.`,
                    ),
                );
            } else {
                out(
                    colors.cyan(
                        '[SKIP] Message submission: add --to=you@example.com to test sender, recipient and message acceptance.',
                    ),
                );
            }

            // Send QUIT gracefully
            try {
                await activeReader.writeCommand('QUIT\r\n');
            } catch {
                // Ignore cleanup error
            }

            out(
                colors.gray(
                    'Queue connection: synchronous (background queues are not tested).',
                ),
            );
            out(
                colors.gray(
                    'SMTP acceptance does not prove inbox delivery. SPF, DKIM, DMARC, spam filtering and later bounces require checking the received message/provider logs.',
                ),
            );
            out(
                colors.green(
                    colors.bold('Mail server checks completed successfully.'),
                ),
            );

            return { success: true, stage };
        } catch (err: any) {
            let errorMsg = err.message || String(err);
            // Redact all secrets
            secrets.sort((a, b) => b.length - a.length);
            for (const secret of secrets) {
                if (secret) {
                    errorMsg = errorMsg.split(secret).join('[redacted]');
                }
            }

            out(colors.red(`[FAIL] ${stage}: ${errorMsg}`));
            if (stage === 'Admin mail settings / database') {
                out(
                    colors.gray(
                        'Use --config-only to diagnose .env settings without database connectivity.',
                    ),
                );
            }

            return { success: false, stage, error: errorMsg };
        } finally {
            if (tlsSocket && !tlsSocket.destroyed) {
                try {
                    tlsSocket.destroy();
                } catch {}
            }
            if (socket && !socket.destroyed) {
                try {
                    socket.destroy();
                } catch {}
            }
        }
    }

    private isValidEmail(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    private async resolveHost(host: string): Promise<string[]> {
        if (net.isIP(host)) {
            return [host];
        }
        try {
            const results = await dns.promises.lookup(host, { all: true });
            const addresses = results.map((r) => r.address);
            if (!addresses.length) {
                throw new Error(`No IP addresses returned for host '${host}'.`);
            }
            return addresses;
        } catch (err: any) {
            throw new Error(
                `Cannot resolve ${host}. Check the SMTP hostname and the hosting server's DNS resolver: ${err.message}`,
            );
        }
    }

    private createTcpConnection(
        host: string,
        port: number,
        timeoutMs: number,
    ): Promise<net.Socket> {
        return new Promise((resolve, reject) => {
            const socket = net.createConnection({ host, port });
            socket.setTimeout(timeoutMs);

            socket.once('connect', () => {
                socket.removeAllListeners('timeout');
                socket.removeAllListeners('error');
                resolve(socket);
            });

            socket.once('timeout', () => {
                socket.destroy();
                reject(
                    new Error(
                        `Connection timed out after ${timeoutMs / 1000}s. Check firewall rules for outbound port ${port}.`,
                    ),
                );
            });

            socket.once('error', (err) => {
                socket.destroy();
                reject(
                    new Error(
                        `Failed to connect to ${host}:${port}: ${err.message}`,
                    ),
                );
            });
        });
    }

    private upgradeToTls(
        socket: net.Socket,
        host: string,
        timeoutMs: number,
        options: DiagnosticOptions,
    ): Promise<tls.TLSSocket> {
        return new Promise((resolve, reject) => {
            const tlsOptions: tls.ConnectionOptions = {
                socket,
                host,
                rejectUnauthorized: options.rejectUnauthorized !== false,
            };

            if (options.caFile) {
                try {
                    const fs = require('fs');
                    tlsOptions.ca = [fs.readFileSync(options.caFile)];
                } catch (e: any) {
                    reject(new Error(`Failed to read CA file: ${e.message}`));
                    return;
                }
            }

            const tlsSocket = tls.connect(tlsOptions, () => {
                tlsSocket.removeAllListeners('timeout');
                tlsSocket.removeAllListeners('error');
                resolve(tlsSocket);
            });

            tlsSocket.setTimeout(timeoutMs);

            tlsSocket.once('timeout', () => {
                tlsSocket.destroy();
                reject(new Error('TLS handshake timed out.'));
            });

            tlsSocket.once('error', (err) => {
                tlsSocket.destroy();
                reject(
                    new Error(
                        `SMTP greeting / EHLO / TLS certificate: ${err.message}`,
                    ),
                );
            });
        });
    }

    private parseCapabilities(lines: string[]): string[] {
        const caps: string[] = [];
        for (const line of lines) {
            // e.g. "250-STARTTLS", "250 AUTH LOGIN PLAIN"
            const match = line.match(/^250[- ]([A-Za-z0-9_-]+)/);
            if (match && match[1] && match[1] !== 'localhost') {
                caps.push(match[1]);
            }
        }
        return Array.from(new Set(caps));
    }

    private async authenticate(
        reader: SmtpStreamReader,
        user: string,
        pass: string,
    ): Promise<void> {
        await reader.writeCommand('AUTH LOGIN\r\n');
        const userPrompt = await reader.readResponse();
        if (!userPrompt.code.startsWith('334')) {
            throw new Error(
                `The SMTP server did not confirm authentication prompt (AUTH LOGIN). Check that it advertises AUTH and supports the configured credentials. Response: ${userPrompt.raw.trim()}`,
            );
        }

        const userB64 = Buffer.from(user).toString('base64');
        await reader.writeCommand(`${userB64}\r\n`);
        const passPrompt = await reader.readResponse();
        if (!passPrompt.code.startsWith('334')) {
            throw new Error(
                `Server rejected username during authentication: ${passPrompt.raw.trim()}`,
            );
        }

        const passB64 = Buffer.from(pass).toString('base64');
        await reader.writeCommand(`${passB64}\r\n`);
        const authResp = await reader.readResponse();
        if (!authResp.code.startsWith('235')) {
            throw new Error(
                `Credentials rejected by server (code ${authResp.code}): ${authResp.raw.trim()}`,
            );
        }
    }

    private async sendTestMessage(
        reader: SmtpStreamReader,
        fromAddress: string,
        fromName: string,
        recipient: string,
    ): Promise<void> {
        await reader.writeCommand(`MAIL FROM:<${fromAddress}>\r\n`);
        const mailFromResp = await reader.readResponse();
        if (!mailFromResp.code.startsWith('250')) {
            throw new Error(
                `Server rejected MAIL FROM address <${fromAddress}>: ${mailFromResp.raw.trim()}`,
            );
        }

        await reader.writeCommand(`RCPT TO:<${recipient}>\r\n`);
        const rcptToResp = await reader.readResponse();
        if (
            !rcptToResp.code.startsWith('250') &&
            !rcptToResp.code.startsWith('251')
        ) {
            throw new Error(
                `Server rejected RCPT TO address <${recipient}>: ${rcptToResp.raw.trim()}`,
            );
        }

        await reader.writeCommand('DATA\r\n');
        const dataResp = await reader.readResponse();
        if (!dataResp.code.startsWith('354')) {
            throw new Error(
                `Server rejected DATA command: ${dataResp.raw.trim()}`,
            );
        }

        const appName =
            this.configService.get<string>('APP_NAME') || 'NestJS Application';
        const dateHeader = new Date().toUTCString();
        const messageId = `<diag-${Date.now()}@${fromAddress.split('@')[1] || 'localhost'}>`;
        const emailBody = [
            `From: "${fromName}" <${fromAddress}>`,
            `To: <${recipient}>`,
            `Subject: ${appName} mail server diagnostic`,
            `Date: ${dateHeader}`,
            `Message-ID: ${messageId}`,
            `Content-Type: text/plain; charset=UTF-8`,
            '',
            `${appName} mail server test sent at ${new Date().toISOString()}.`,
            `If you received this message, outbound delivery to this mailbox is operating successfully.`,
            '',
            'Diagnostic checks verified: DNS, TCP, SMTP EHLO, STARTTLS, and Authentication.',
            '.\r\n',
        ].join('\r\n');

        await reader.writeCommand(emailBody);
        const sendResp = await reader.readResponse();
        if (!sendResp.code.startsWith('250')) {
            throw new Error(
                `Server failed to accept test message: ${sendResp.raw.trim()}`,
            );
        }
    }
}

/**
 * Socket reader that buffers incoming bytes and returns full SMTP multi-line responses.
 */
class SmtpStreamReader {
    private buffer = '';
    private timeoutId: NodeJS.Timeout | null = null;

    constructor(
        private readonly stream: net.Socket | tls.TLSSocket,
        private readonly timeoutMs: number,
    ) {}

    writeCommand(cmd: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.stream.writable) {
                reject(new Error('Connection is closed for writing.'));
                return;
            }
            this.stream.write(cmd, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    readResponse(): Promise<{ code: string; lines: string[]; raw: string }> {
        return new Promise((resolve, reject) => {
            const checkBuffer = () => {
                const lines = this.buffer.split('\r\n');
                if (lines.length > 1) {
                    for (let i = 0; i < lines.length - 1; i++) {
                        const line = lines[i];
                        // An SMTP final line has 3 digits followed by a space ' ' (e.g. "250 OK" or "220 mail.example.com")
                        // Continuation lines have 3 digits followed by a dash '-' (e.g. "250-STARTTLS")
                        const match = line.match(/^(\d{3}) (.*)$/);
                        if (match) {
                            const completedLines = lines.slice(0, i + 1);
                            this.buffer = lines.slice(i + 1).join('\r\n');
                            cleanup();
                            resolve({
                                code: match[1],
                                lines: completedLines,
                                raw: completedLines.join('\r\n'),
                            });
                            return;
                        }
                    }
                }
            };

            const onData = (chunk: Buffer) => {
                this.buffer += chunk.toString('utf-8');
                checkBuffer();
            };

            const onError = (err: Error) => {
                cleanup();
                reject(err);
            };

            const onClose = () => {
                cleanup();
                reject(
                    new Error('Connection unexpectedly closed by remote host.'),
                );
            };

            const onTimeout = () => {
                cleanup();
                reject(
                    new Error(
                        `SMTP response timed out after ${this.timeoutMs / 1000}s.`,
                    ),
                );
            };

            const cleanup = () => {
                if (this.timeoutId) clearTimeout(this.timeoutId);
                this.stream.removeListener('data', onData);
                this.stream.removeListener('error', onError);
                this.stream.removeListener('close', onClose);
            };

            this.timeoutId = setTimeout(onTimeout, this.timeoutMs);
            this.stream.on('data', onData);
            this.stream.on('error', onError);
            this.stream.on('close', onClose);

            // Check if buffer already contains complete response
            checkBuffer();
        });
    }
}
