import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';
import { MailQueueEventsListener } from './mail-queue-events.listener';
import { MailDiagnosticsService } from './mail-diagnostics.service';
import { TemplateModule } from '../template/template.module';

@Global()
@Module({
    imports: [
        TemplateModule,
        BullModule.registerQueue({
            name: 'mail',
        }),
    ],
    providers: [
        MailService,
        MailProcessor,
        MailQueueEventsListener,
        MailDiagnosticsService,
    ],
    exports: [MailService, MailDiagnosticsService, BullModule],
})
export class MailModule {}
