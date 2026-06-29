import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import sanitizeHtml from 'sanitize-html';
import { EmailTemplate } from './email-template/email-template.entity';
import { CreateEmailTemplateDto } from './email-template/dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './email-template/dto/update-email-template.dto';

@Injectable()
export class EmailTemplateService {
  private sanitizeVariables(variables: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sanitizeOptions: any = {
      allowedTags: [],
      allowedAttributes: {},
    };

    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === 'string') {
        if (key.includes('url') || key.includes('link') || key.includes('href')) {
          sanitized[key] = sanitizeHtml(value, {
            allowedTags: [],
            allowedAttributes: {},
            allowedSchemes: ['http', 'https', 'mailto'],
          });
        } else {
          sanitized[key] = sanitizeHtml(value, sanitizeOptions);
        }
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  constructor(
    @InjectRepository(EmailTemplate)
    private readonly repository: Repository<EmailTemplate>,
  ) {}

  async create(dto: CreateEmailTemplateDto) {
    return this.repository.save(dto);
  }

  async update(id: string, dto: UpdateEmailTemplateDto) {
    await this.repository.update(id, dto);

    return this.findById(id);
  }

  async findById(id: string) {
    const template = await this.repository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async preview(id: string, variables: Record<string, string>) {
    const template = await this.findById(id);
    const sanitizedVariables = this.sanitizeVariables(variables);

    let subject = template.subject;
    let body = template.body;

    Object.entries(sanitizedVariables).forEach(([key, value]) => {
      const token = `{{${key}}}`;
      subject = subject.replaceAll(token, value);
      body = body.replaceAll(token, value);
    });

    return {
      subject,
      body,
    };
  }
}
