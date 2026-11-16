import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type QueueLogDocument = QueueLog & Document;

@Schema({
    collection: 'queue_logs',
    timestamps: { createdAt: 'created_at', updatedAt: false },
})
export class QueueLog {
    @Prop({ required: true, index: true })
    queue_name: string;

    @Prop({ required: true, index: true })
    job_id: string;

    @Prop({ required: true, index: true })
    job_name: string;

    @Prop({ required: true, index: true })
    event: string; // 'waiting' | 'active' | 'completed' | 'failed' | 'stalled' | 'retried' | 'progress'

    @Prop({ type: Object })
    payload?: Record<string, any>;

    @Prop({ type: Object })
    result?: Record<string, any>;

    @Prop()
    error?: string;

    @Prop()
    stack?: string;

    @Prop({ default: 0 })
    attempts_made?: number;

    @Prop()
    duration_ms?: number;

    @Prop({ default: Date.now, index: true })
    created_at: Date;
}

export const QueueLogSchema = SchemaFactory.createForClass(QueueLog);
