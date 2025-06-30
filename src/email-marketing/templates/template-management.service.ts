import { Injectable } from '@nestjs/common';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TemplateManagementService {
  private templates: EmailTemplate[] = [];

  createTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>): EmailTemplate {
    const newTemplate: EmailTemplate = {
      ...template,
      id: Math.random().toString(36).substring(2),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.templates.push(newTemplate);
    return newTemplate;
  }

  editTemplate(id: string, updates: Partial<Omit<EmailTemplate, 'id' | 'createdAt'>>): EmailTemplate | undefined {
    const template = this.templates.find(t => t.id === id);
    if (template) {
      Object.assign(template, updates, { updatedAt: new Date() });
      return template;
    }
    return undefined;
  }

  getTemplate(id: string): EmailTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  deleteTemplate(id: string): boolean {
    const idx = this.templates.findIndex(t => t.id === id);
    if (idx > -1) {
      this.templates.splice(idx, 1);
      return true;
    }
    return false;
  }

  listTemplates(): EmailTemplate[] {
    return this.templates;
  }
}
