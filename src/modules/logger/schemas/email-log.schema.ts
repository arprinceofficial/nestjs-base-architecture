import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type EmailLogDocument = EmailLog & Document;

@Schema({ collection: 'email_logs', timestamps: { createdAt: 'created_at', updatedAt: false } })
export class EmailLog {
  @Prop({ required: true, index: true })
  mail_id: string;

  @Prop({ required: true, index: true })
  to: string;

  @Prop({ required: true })
  from: string;

  @Prop({ required: true })
  subject: string;

  @Prop()
  body_text?: string;

  @Prop()
  body_html?: string;

  @Prop({ required: true, index: true })
  status: string; // 'success' | 'error' | 'skipped'

  @Prop()
  error?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  smtp_response?: Record<string, any>;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: Record<string, any>;

  @Prop({ default: Date.now, index: true })
  created_at: Date;
}

export const EmailLogSchema = SchemaFactory.createForClass(EmailLog);
