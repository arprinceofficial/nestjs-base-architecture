import {
    QueueEventsHost,
    QueueEventsListener,
    OnQueueEvent,
} from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { MongoLoggerService } from '@/modules/logger/mongo-logger.service';

@QueueEventsListener('mail')
export class MailQueueEventsListener extends QueueEventsHost {
    private readonly logger = new Logger(MailQueueEventsListener.name);

    constructor(private readonly mongoLoggerService: MongoLoggerService) {
        super();
    }

    @OnQueueEvent('waiting')
    async onWaiting({ jobId }: { jobId: string }) {
        this.logger.debug(`[Queue: mail] Job ${jobId} is waiting`);
    }

    @OnQueueEvent('active')
    async onActive({ jobId, prev }: { jobId: string; prev?: string }) {
        this.logger.debug(`[Queue: mail] Job ${jobId} became active`);
    }

    @OnQueueEvent('completed')
    async onCompleted({
        jobId,
        returnvalue,
    }: {
        jobId: string;
        returnvalue: any;
    }) {
        this.logger.debug(`[Queue: mail] Job ${jobId} completed successfully`);
    }

    @OnQueueEvent('failed')
    async onFailed({
        jobId,
        failedReason,
    }: {
        jobId: string;
        failedReason: string;
    }) {
        this.logger.warn(`[Queue: mail] Job ${jobId} failed: ${failedReason}`);
    }

    @OnQueueEvent('progress')
    async onProgress({
        jobId,
        data,
    }: {
        jobId: string;
        data: number | object;
    }) {
        await this.mongoLoggerService.logQueueEvent({
            queue_name: 'mail',
            job_id: String(jobId),
            job_name: 'send_mail',
            event: 'progress',
            payload:
                typeof data === 'object' ? (data as any) : { progress: data },
        });
    }

    @OnQueueEvent('stalled')
    async onStalled({ jobId }: { jobId: string }) {
        this.logger.warn(`[Queue: mail] Job ${jobId} stalled`);
        await this.mongoLoggerService.logQueueEvent({
            queue_name: 'mail',
            job_id: String(jobId),
            job_name: 'send_mail',
            event: 'stalled',
            error: 'Job stalled on worker',
        });
    }
}
