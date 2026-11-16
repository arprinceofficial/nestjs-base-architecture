import * as net from 'net';
import { describe, it, before, after, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { MailDiagnosticsService } from '../src/modules/mail/mail-diagnostics.service';

function createMockConfig(values: Record<string, any>) {
    return {
        get: (key: string) => values[key],
    } as any;
}

describe('MailDiagnosticsService', () => {
    let mockServer: net.Server;
    let mockPort: number;
    let serverMode: 'normal' | 'reject_auth' | 'no_auth' = 'normal';

    before(async () => {
        mockServer = net.createServer((socket) => {
            socket.write('220 localhost Mock SMTP Server ready\r\n');
            let isDataMode = false;
            let authStep = 0;

            let buffer = '';
            socket.on('data', (chunk) => {
                buffer += chunk.toString('utf-8');
                let idx: number;
                while ((idx = buffer.indexOf('\r\n')) !== -1) {
                    const line = buffer.substring(0, idx).trim();
                    buffer = buffer.substring(idx + 2);

                    if (isDataMode) {
                        if (line === '.') {
                            isDataMode = false;
                            socket.write('250 2.0.0 OK: message accepted\r\n');
                        }
                        continue;
                    }

                    if (authStep > 0) {
                        if (authStep === 1) {
                            // Received username
                            authStep = 2;
                            socket.write('334 UGFzc3dvcmQ6\r\n'); // Password:
                        } else if (authStep === 2) {
                            // Received password
                            authStep = 0;
                            if (serverMode === 'reject_auth') {
                                socket.write(
                                    '535 5.7.8 Authentication credentials invalid\r\n',
                                );
                            } else {
                                socket.write(
                                    '235 2.7.0 Authentication successful\r\n',
                                );
                            }
                        }
                        continue;
                    }

                    if (line.startsWith('EHLO') || line.startsWith('HELO')) {
                        if (serverMode === 'no_auth') {
                            socket.write('250-localhost\r\n250 HELP\r\n');
                        } else {
                            socket.write('250-localhost\r\n250 AUTH LOGIN\r\n');
                        }
                    } else if (line === 'AUTH LOGIN') {
                        authStep = 1;
                        socket.write('334 VXNlcm5hbWU6\r\n'); // Username:
                    } else if (line.startsWith('MAIL FROM:')) {
                        socket.write('250 2.1.0 Sender OK\r\n');
                    } else if (line.startsWith('RCPT TO:')) {
                        socket.write('250 2.1.5 Recipient OK\r\n');
                    } else if (line === 'DATA') {
                        isDataMode = true;
                        socket.write(
                            '354 Start mail input; end with <CRLF>.<CRLF>\r\n',
                        );
                    } else if (line === 'QUIT') {
                        socket.write('221 2.0.0 Bye\r\n');
                        socket.end();
                    } else {
                        socket.write('250 OK\r\n');
                    }
                }
            });
        });

        await new Promise<void>((resolve) => {
            mockServer.listen(0, '127.0.0.1', () => {
                const addr = mockServer.address() as net.AddressInfo;
                mockPort = addr.port;
                resolve();
            });
        });
    });

    after(async () => {
        await new Promise<void>((resolve) => {
            mockServer.close(() => resolve());
        });
    });

    beforeEach(() => {
        serverMode = 'normal';
    });

    it('should reject invalid recipient email format before connecting', async () => {
        const configService = createMockConfig({
            SMTP_HOST: '127.0.0.1',
            SMTP_PORT: mockPort,
            SMTP_FROM: 'test@example.com',
        });
        const service = new MailDiagnosticsService(configService);

        await assert.rejects(
            async () => {
                await service.runDiagnostics({ to: 'invalid-email-format' });
            },
            {
                name: 'Error',
                message: '--to must be a valid email address.',
            },
        );
    });

    it('should fail at Outbound TCP stage if port is closed', async () => {
        const configService = createMockConfig({
            SMTP_HOST: '127.0.0.1',
            SMTP_PORT: 65530, // Unlikely to have a listener
            SMTP_FROM: 'test@example.com',
        });
        const service = new MailDiagnosticsService(configService);
        const logs: string[] = [];

        const result = await service.runDiagnostics({
            configOnly: true,
            timeout: 1,
            logger: (line) => logs.push(line),
        });

        assert.strictEqual(result.success, false);
        assert.strictEqual(result.stage, 'Outbound TCP');
        assert.ok(logs.some((l) => l.includes('[FAIL] Outbound TCP')));
    });

    it('should refuse to test credentials over unencrypted connection unless allowed', async () => {
        const configService = createMockConfig({
            SMTP_HOST: '127.0.0.1',
            SMTP_PORT: mockPort,
            SMTP_USER: 'testuser',
            SMTP_PASS: 'secretpassword',
            SMTP_FROM: 'sender@example.com',
        });
        const service = new MailDiagnosticsService(configService);
        const logs: string[] = [];

        const result = await service.runDiagnostics({
            configOnly: true,
            logger: (line) => logs.push(line),
        });

        assert.strictEqual(result.success, false);
        assert.strictEqual(result.stage, 'TLS / SSL negotiation');
        assert.ok(
            logs.some((l) =>
                l.includes(
                    'Refusing to test credentials over an unencrypted connection',
                ),
            ),
        );
    });

    it('should succeed and send test email when --to is supplied', async () => {
        const configService = createMockConfig({
            SMTP_HOST: '127.0.0.1',
            SMTP_PORT: mockPort,
            SMTP_USER: 'testuser',
            SMTP_PASS: 'secretpassword',
            SMTP_FROM: 'sender@example.com',
        });
        const service = new MailDiagnosticsService(configService);
        const logs: string[] = [];

        const result = await service.runDiagnostics({
            configOnly: true,
            allowInsecureAuth: true,
            to: 'recipient@example.com',
            logger: (line) => logs.push(line),
        });

        assert.strictEqual(result.success, true);
        assert.ok(logs.some((l) => l.includes('[PASS] Outbound TCP')));
        assert.ok(logs.some((l) => l.includes('[PASS] SMTP authentication')));
        assert.ok(
            logs.some((l) =>
                l.includes('[PASS] SMTP server accepted the test message'),
            ),
        );
    });

    it('should fail at SMTP authentication stage when credentials are rejected and redact password', async () => {
        serverMode = 'reject_auth';
        const configService = createMockConfig({
            SMTP_HOST: '127.0.0.1',
            SMTP_PORT: mockPort,
            SMTP_USER: 'testuser',
            SMTP_PASS: 'super_secret_fixture_pass',
            SMTP_FROM: 'sender@example.com',
        });
        const service = new MailDiagnosticsService(configService);
        const logs: string[] = [];

        const result = await service.runDiagnostics({
            configOnly: true,
            allowInsecureAuth: true,
            logger: (line) => logs.push(line),
        });

        assert.strictEqual(result.success, false);
        assert.strictEqual(result.stage, 'SMTP authentication');
        assert.ok(logs.some((l) => l.includes('[FAIL] SMTP authentication')));
        // Ensure secret password is never leaked in log output
        assert.ok(!logs.join('\n').includes('super_secret_fixture_pass'));
    });
});
