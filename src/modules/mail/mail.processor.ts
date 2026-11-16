import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from './mail.service';
import { MongoLoggerService } from '@/modules/logger/mongo-logger.service';

@Processor('mail')
export class MailProcessor extends WorkerHost {
    private readonly logger = new Logger(MailProcessor.name);

    constructor(
        private readonly mailService: MailService,
        private readonly mongoLoggerService: MongoLoggerService,
    ) {
        super();
    }

    /**
     * Processes background mail jobs from the BullMQ 'mail' queue.
     */
    async process(job: Job<any, any, string>): Promise<any> {
        const startTime = Date.now();
        this.logger.log(
            `Processing mail job [${job.id}] (${job.name}) for: ${job.data?.to}`,
        );

        // 1. Log active event to MongoDB
        await this.mongoLoggerService.logQueueEvent({
            queue_name: 'mail',
            job_id: String(job.id),
            job_name: job.name,
            event: 'active',
            payload: job.data,
            attempts_made: job.attemptsMade,
        });

        try {
            // 2. Execute SMTP dispatch
            const result = await this.mailService.sendDirect(job.data);
            const durationMs = Date.now() - startTime;

            this.logger.log(
                `Mail job [${job.id}] completed in ${durationMs}ms: Message ID: ${result.messageId || 'N/A'}`,
            );

            // 3. Log completed event to MongoDB
            await this.mongoLoggerService.logQueueEvent({
                queue_name: 'mail',
                job_id: String(job.id),
                job_name: job.name,
                event: 'completed',
                payload: job.data,
                result,
                duration_ms: durationMs,
                attempts_made: job.attemptsMade + 1,
            });

            return result;
        } catch (error: any) {
            const durationMs = Date.now() - startTime;
            this.logger.error(
                `Mail job [${job.id}] failed after ${durationMs}ms: ${error.message}`,
                error.stack,
            );

            // 4. Log failed event to MongoDB
            await this.mongoLoggerService.logQueueEvent({
                queue_name: 'mail',
                job_id: String(job.id),
                job_name: job.name,
                event: 'failed',
                payload: job.data,
                error: error.message,
                stack: error.stack,
                duration_ms: durationMs,
                attempts_made: job.attemptsMade + 1,
            });

            throw error;
        }
    }
}
