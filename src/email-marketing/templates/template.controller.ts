import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TemplateManagementService } from './template-management.service';
import { CreateTemplateDto } from '../dto/create-template.dto';
import { UpdateTemplateDto } from '../dto/update-template.dto';
import { EmailTemplate } from '../entities/email-template.entity';

/**
 * Exposes template endpoints.
 */
@ApiTags('Email Marketing - Templates')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Authentication required' })
@Controller('email-marketing/templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateManagementService) {}

  /**
   * Creates a new record.
   * @param createTemplateDto The request payload.
   * @returns The resulting email template.
   */
  @Post()
  @ApiOperation({ summary: 'Create a new email template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async create(@Body() createTemplateDto: CreateTemplateDto): Promise<EmailTemplate> {
    return this.templateService.create(createTemplateDto);
  }

  /**
   * Returns all.
   * @param page The page number.
   * @param limit The maximum number of results.
   * @returns The operation result.
   */
  @Get()
  @ApiOperation({ summary: 'Get all email templates' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of email templates' })
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.templateService.findAll(page, limit);
  }

  /**
   * Returns one.
   * @param id The identifier.
   * @returns The resulting email template.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a template by ID' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<EmailTemplate> {
    return this.templateService.findOne(id);
  }

  /**
   * Updates the requested record.
   * @param id The identifier.
   * @param updateTemplateDto The request payload.
   * @returns The resulting email template.
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update a template' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ): Promise<EmailTemplate> {
    return this.templateService.update(id, updateTemplateDto);
  }

  /**
   * Removes the requested record.
   * @param id The identifier.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a template' })
  @ApiResponse({ status: 204, description: 'Template deleted successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.templateService.remove(id);
  }

  /**
   * Executes duplicate.
   * @param id The identifier.
   * @returns The resulting email template.
   */
  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a template' })
  @ApiResponse({ status: 201, description: 'Template duplicated successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async duplicate(@Param('id', ParseUUIDPipe) id: string): Promise<EmailTemplate> {
    return this.templateService.duplicate(id);
  }

  /**
   * Executes preview.
   * @param id The identifier.
   * @param sampleData The data to process.
   * @returns The operation result.
   */
  @Post(':id/preview')
  @ApiOperation({ summary: 'Preview a template with sample data' })
  @ApiResponse({ status: 201, description: 'Rendered template preview' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async preview(@Param('id', ParseUUIDPipe) id: string, @Body() sampleData?: Record<string, any>) {
    return this.templateService.previewTemplate(id, sampleData);
  }

  /**
   * Executes render.
   * @param id The identifier.
   * @param variables The variables.
   * @returns The operation result.
   */
  @Post(':id/render')
  @ApiOperation({ summary: 'Render a template with provided variables' })
  @ApiResponse({ status: 201, description: 'Rendered template output' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async render(@Param('id', ParseUUIDPipe) id: string, @Body() variables: Record<string, any>) {
    return this.templateService.renderTemplate(id, variables);
  }
}
