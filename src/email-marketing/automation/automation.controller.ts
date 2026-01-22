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
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
} from '@nestjs/swagger';

import { AutomationService } from './automation.service';
import { CreateAutomationDto } from '../dto/create-automation.dto';
import { UpdateAutomationDto } from '../dto/update-automation.dto';
import { AutomationWorkflow } from '../entities/automation-workflow.entity';

@ApiTags('Email Marketing - Automation')
@ApiBearerAuth()
@Controller('email-marketing/automation')
export class AutomationController {
    constructor(private readonly automationService: AutomationService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new automation workflow' })
    @ApiResponse({ status: 201, description: 'Workflow created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    async create(@Body() createAutomationDto: CreateAutomationDto): Promise<AutomationWorkflow> {
        return this.automationService.create(createAutomationDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all automation workflows' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'List of automation workflows' })
    async findAll(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        return this.automationService.findAll(page, limit);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get an automation workflow by ID' })
    @ApiResponse({ status: 200, description: 'Workflow details' })
    @ApiResponse({ status: 404, description: 'Workflow not found' })
    async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AutomationWorkflow> {
        return this.automationService.findOne(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update an automation workflow' })
    @ApiResponse({ status: 200, description: 'Workflow updated successfully' })
    @ApiResponse({ status: 400, description: 'Cannot update active workflow' })
    @ApiResponse({ status: 404, description: 'Workflow not found' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateAutomationDto: UpdateAutomationDto,
    ): Promise<AutomationWorkflow> {
        return this.automationService.update(id, updateAutomationDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete an automation workflow' })
    @ApiResponse({ status: 204, description: 'Workflow deleted successfully' })
    @ApiResponse({ status: 400, description: 'Cannot delete active workflow' })
    @ApiResponse({ status: 404, description: 'Workflow not found' })
    async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        return this.automationService.remove(id);
    }

    @Post(':id/activate')
    @ApiOperation({ summary: 'Activate an automation workflow' })
    @ApiResponse({ status: 200, description: 'Workflow activated' })
    @ApiResponse({ status: 400, description: 'Workflow has no triggers or actions' })
    async activate(@Param('id', ParseUUIDPipe) id: string): Promise<AutomationWorkflow> {
        return this.automationService.activate(id);
    }

    @Post(':id/deactivate')
    @ApiOperation({ summary: 'Deactivate an automation workflow' })
    @ApiResponse({ status: 200, description: 'Workflow deactivated' })
    async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<AutomationWorkflow> {
        return this.automationService.deactivate(id);
    }

    @Get(':id/stats')
    @ApiOperation({ summary: 'Get workflow execution statistics' })
    @ApiResponse({ status: 200, description: 'Workflow statistics' })
    @ApiResponse({ status: 404, description: 'Workflow not found' })
    async getStats(@Param('id', ParseUUIDPipe) id: string) {
        return this.automationService.getWorkflowStats(id);
    }
}
