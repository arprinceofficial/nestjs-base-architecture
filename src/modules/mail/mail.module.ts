import { Module, Global } from '@nestjs/common';
import { MailService } from './mail.service';
import { TemplateModule } from '../template/template.module';

@Global()
@Module({
    imports: [TemplateModule],
    providers: [MailService],
    exports: [MailService],
})
export class MailModule {}
