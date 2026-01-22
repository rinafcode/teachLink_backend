import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Handlebars from 'handlebars';

import { EmailTemplate } from '../entities/email-template.entity';
import { CreateTemplateDto } from '../dto/create-template.dto';
import { UpdateTemplateDto } from '../dto/update-template.dto';

@Injectable()
export class TemplateManagementService {
    constructor(
        @InjectRepository(EmailTemplate)
        private readonly templateRepository: Repository<EmailTemplate>,
    ) {
        this.registerHandlebarsHelpers();
    }

    /**
     * Create a new email template
     */
    async create(createTemplateDto: CreateTemplateDto): Promise<EmailTemplate> {
        // Validate template syntax
        this.validateTemplateSyntax(createTemplateDto.htmlContent);
        if (createTemplateDto.textContent) {
            this.validateTemplateSyntax(createTemplateDto.textContent);
        }

        const template = this.templateRepository.create({
            ...createTemplateDto,
            variables: this.extractVariables(createTemplateDto.htmlContent),
        });

        return this.templateRepository.save(template);
    }

    /**
     * Get all templates
     */
    async findAll(page = 1, limit = 10): Promise<{
        templates: EmailTemplate[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const [templates, total] = await this.templateRepository.findAndCount({
            skip: (page - 1) * limit,
            take: limit,
            order: { createdAt: 'DESC' },
        });

        return { templates, total, page, totalPages: Math.ceil(total / limit) };
    }

    /**
     * Get a single template by ID
     */
    async findOne(id: string): Promise<EmailTemplate> {
        const template = await this.templateRepository.findOne({ where: { id } });
        if (!template) {
            throw new NotFoundException(`Template with ID ${id} not found`);
        }
        return template;
    }

    /**
     * Update a template
     */
    async update(id: string, updateTemplateDto: UpdateTemplateDto): Promise<EmailTemplate> {
        const template = await this.findOne(id);

        if (updateTemplateDto.htmlContent) {
            this.validateTemplateSyntax(updateTemplateDto.htmlContent);
            updateTemplateDto['variables'] = this.extractVariables(updateTemplateDto.htmlContent);
        }

        Object.assign(template, updateTemplateDto);
        return this.templateRepository.save(template);
    }

    /**
     * Delete a template
     */
    async remove(id: string): Promise<void> {
        const template = await this.findOne(id);
        await this.templateRepository.remove(template);
    }

    /**
     * Duplicate a template
     */
    async duplicate(id: string): Promise<EmailTemplate> {
        const original = await this.findOne(id);

        const duplicate = this.templateRepository.create({
            name: `${original.name} (Copy)`,
            subject: original.subject,
            htmlContent: original.htmlContent,
            textContent: original.textContent,
            category: original.category,
            variables: original.variables,
        });

        return this.templateRepository.save(duplicate);
    }

    /**
     * Render a template with variables
     */
    async renderTemplate(
        templateId: string,
        variables: Record<string, any>,
    ): Promise<{ html: string; text: string; subject: string }> {
        const template = await this.findOne(templateId);

        const htmlTemplate = Handlebars.compile(template.htmlContent);
        const subjectTemplate = Handlebars.compile(template.subject);
        const textTemplate = template.textContent
            ? Handlebars.compile(template.textContent)
            : null;

        return {
            html: htmlTemplate(variables),
            text: textTemplate ? textTemplate(variables) : this.stripHtml(htmlTemplate(variables)),
            subject: subjectTemplate(variables),
        };
    }

    /**
     * Preview a template with sample data
     */
    async previewTemplate(id: string, sampleData?: Record<string, any>) {
        const template = await this.findOne(id);

        const defaultData = this.generateSampleData(template.variables || []);
        const data = { ...defaultData, ...sampleData };

        return this.renderTemplate(id, data);
    }

    // Private helper methods
    private validateTemplateSyntax(content: string): void {
        try {
            Handlebars.compile(content);
        } catch (error) {
            throw new BadRequestException(`Invalid template syntax: ${error.message}`);
        }
    }

    private extractVariables(content: string): string[] {
        const regex = /\{\{([^}]+)\}\}/g;
        const variables = new Set<string>();
        let match;

        while ((match = regex.exec(content)) !== null) {
            const variable = match[1].trim().split(' ')[0];
            if (!variable.startsWith('#') && !variable.startsWith('/')) {
                variables.add(variable);
            }
        }

        return Array.from(variables);
    }

    private generateSampleData(variables: string[]): Record<string, any> {
        const sampleData: Record<string, any> = {};

        for (const variable of variables) {
            if (variable.includes('name')) sampleData[variable] = 'John Doe';
            else if (variable.includes('email')) sampleData[variable] = 'john@example.com';
            else if (variable.includes('url') || variable.includes('link')) {
                sampleData[variable] = 'https://example.com';
            } else {
                sampleData[variable] = `[${variable}]`;
            }
        }

        return sampleData;
    }

    private stripHtml(html: string): string {
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    private registerHandlebarsHelpers(): void {
        Handlebars.registerHelper('uppercase', (str) => str?.toUpperCase());
        Handlebars.registerHelper('lowercase', (str) => str?.toLowerCase());
        Handlebars.registerHelper('formatDate', (date) => new Date(date).toLocaleDateString());
        Handlebars.registerHelper('ifEquals', function (a, b, options) {
            return a === b ? options.fn(this) : options.inverse(this);
        });
    }
}
