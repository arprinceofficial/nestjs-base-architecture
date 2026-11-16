import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ErrorLogDocument = ErrorLog & Document;

@Schema({
    collection: 'error_logs',
    timestamps: { createdAt: 'created_at', updatedAt: false },
})
export class ErrorLog {
    @Prop({ required: true, index: true })
    error_id: string;

    @Prop({ default: 'error', index: true })
    level: string;

    @Prop({ index: true })
    status_code: number;

    @Prop({ required: true })
    message: string;

    @Prop()
    error_name: string;

    @Prop()
    stack?: string;

    @Prop({ index: true })
    path: string;

    @Prop()
    method: string;

    @Prop()
    ip?: string;

    @Prop()
    user_agent?: string;

    @Prop({ index: true })
    user_id?: number;

    @Prop()
    user_email?: string;

    @Prop({ type: MongooseSchema.Types.Mixed })
    query?: Record<string, any>;

    @Prop({ type: MongooseSchema.Types.Mixed })
    params?: Record<string, any>;

    @Prop({ type: MongooseSchema.Types.Mixed })
    body?: Record<string, any>;

    @Prop({ type: MongooseSchema.Types.Mixed })
    headers?: Record<string, any>;

    @Prop({ default: Date.now, index: true })
    created_at: Date;
}

export const ErrorLogSchema = SchemaFactory.createForClass(ErrorLog);
