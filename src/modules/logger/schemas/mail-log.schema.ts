import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type MailLogDocument = MailLog & Document;

@Schema({ collection: 'mail_logs', timestamps: { createdAt: 'created_at', updatedAt: false } })
export class MailLog {
  @Prop({ required: true, index: true })
  mail_id: string;

  @Prop({ required: true, index: true })
  to: string;

  @Prop({ required: true })
  from: string;

  @Prop({ required: true })
  subject: string;

  @Prop()
  text?: string;

  @Prop()
  html?: string;

  @Prop({ required: true, index: true, default: 'sent' })
  status: string; // 'sent' | 'failed' | 'skipped'

  @Prop()
  error?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: Record<string, any>;

  @Prop({ default: Date.now, index: true })
  created_at: Date;
}

export const MailLogSchema = SchemaFactory.createForClass(MailLog);
