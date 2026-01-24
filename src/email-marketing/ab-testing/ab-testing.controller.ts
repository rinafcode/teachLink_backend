import {
    Controller, Get, Post, Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { ABTestingService } from './ab-testing.service';
import { CreateABTestDto } from '../dto/create-ab-test.dto';
import { ABTest } from '../entities/ab-test.entity';

@ApiTags('Email Marketing - A/B Testing')
@ApiBearerAuth()
@Controller('email-marketing/ab-tests')
export class ABTestingController {
    constructor(private readonly abTestingService: ABTestingService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new A/B test' })
    @ApiResponse({ status: 201, description: 'A/B test created successfully' })
    async create(@Body() createABTestDto: CreateABTestDto): Promise<ABTest> {
        return this.abTestingService.create(createABTestDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all A/B tests' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
        return this.abTestingService.findAll(page, limit);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get an A/B test by ID' })
    @ApiResponse({ status: 404, description: 'A/B test not found' })
    async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ABTest> {
        return this.abTestingService.findOne(id);
    }

    @Post(':id/start')
    @ApiOperation({ summary: 'Start an A/B test' })
    async startTest(@Param('id', ParseUUIDPipe) id: string): Promise<ABTest> {
        return this.abTestingService.startTest(id);
    }

    @Get(':id/results')
    @ApiOperation({ summary: 'Get A/B test results with statistical analysis' })
    async getResults(@Param('id', ParseUUIDPipe) id: string) {
        return this.abTestingService.getTestResults(id);
    }

    @Post(':id/winner/:variantId')
    @ApiOperation({ summary: 'Declare a winner for the A/B test' })
    async declareWinner(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('variantId', ParseUUIDPipe) variantId: string,
    ): Promise<ABTest> {
        return this.abTestingService.declareWinner(id, variantId);
    }
}
