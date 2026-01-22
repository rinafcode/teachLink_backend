import {
    Controller, Get, Post, Put, Delete, Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { TemplateManagementService } from './template-management.service';
import { CreateTemplateDto } from '../dto/create-template.dto';
import { UpdateTemplateDto } from '../dto/update-template.dto';
import { EmailTemplate } from '../entities/email-template.entity';

@ApiTags('Email Marketing - Templates')
@ApiBearerAuth()
@Controller('email-marketing/templates')
export class TemplateController {
    constructor(private readonly templateService: TemplateManagementService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new email template' })
    @ApiResponse({ status: 201, description: 'Template created successfully' })
    async create(@Body() createTemplateDto: CreateTemplateDto): Promise<EmailTemplate> {
        return this.templateService.create(createTemplateDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all email templates' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
        return this.templateService.findAll(page, limit);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a template by ID' })
    @ApiResponse({ status: 404, description: 'Template not found' })
    async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<EmailTemplate> {
        return this.templateService.findOne(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a template' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateTemplateDto: UpdateTemplateDto,
    ): Promise<EmailTemplate> {
        return this.templateService.update(id, updateTemplateDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a template' })
    async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        return this.templateService.remove(id);
    }

    @Post(':id/duplicate')
    @ApiOperation({ summary: 'Duplicate a template' })
    async duplicate(@Param('id', ParseUUIDPipe) id: string): Promise<EmailTemplate> {
        return this.templateService.duplicate(id);
    }

    @Post(':id/preview')
    @ApiOperation({ summary: 'Preview a template with sample data' })
    async preview(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() sampleData?: Record<string, any>,
    ) {
        return this.templateService.previewTemplate(id, sampleData);
    }

    @Post(':id/render')
    @ApiOperation({ summary: 'Render a template with provided variables' })
    async render(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() variables: Record<string, any>,
    ) {
        return this.templateService.renderTemplate(id, variables);
    }
}
