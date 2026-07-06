import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { RoutingConfigService } from '../services/routing-config.service';
import { RoutingEngineService } from '../services/routing-engine.service';
import { RoutingRule } from '../interfaces/routing.interface';
import {
  CreateRoutingRuleDto,
  UpdateRoutingRuleDto,
  UpdateRoutingConfigDto,
  RoutingRuleResponseDto,
  RoutingConfigResponseDto,
  RoutingStatsResponseDto,
} from '../dto/routing.dto';

/**
 * Controller for managing dynamic routing configuration
 */
@ApiTags('routing-admin')
@Controller('admin/routing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
export class RoutingAdminController {
  constructor(
    private readonly routingConfig: RoutingConfigService,
    private readonly routingEngine: RoutingEngineService,
  ) {}

  /**
   * Get current routing configuration
   */
  @Get('config')
  @ApiOperation({ summary: 'Get routing configuration' })
  @ApiResponse({
    status: 200,
    description: 'Routing configuration retrieved',
    type: RoutingConfigResponseDto,
  })
  async getConfig(): Promise<RoutingConfigResponseDto> {
    const config = this.routingConfig.getConfig();
    return {
      success: true,
      data: config,
      message: 'Routing configuration retrieved successfully',
    };
  }

  /**
   * Update routing configuration
   */
  @Put('config')
  @ApiOperation({ summary: 'Update routing configuration' })
  @ApiResponse({ status: 200, description: 'Routing configuration updated' })
  async updateConfig(@Body() updateDto: UpdateRoutingConfigDto): Promise<any> {
    await this.routingConfig.updateConfig(updateDto);
    return {
      success: true,
      message: 'Routing configuration updated successfully',
    };
  }

  /**
   * Get all routing rules
   */
  @Get('rules')
  @ApiOperation({ summary: 'Get all routing rules' })
  @ApiResponse({
    status: 200,
    description: 'Routing rules retrieved',
    type: [RoutingRuleResponseDto],
  })
  @ApiQuery({
    name: 'enabled',
    required: false,
    type: Boolean,
    description: 'Filter by enabled status',
  })
  async getRules(@Query('enabled') enabled?: boolean): Promise<any> {
    let rules = this.routingConfig.getRules();

    if (enabled !== undefined) {
      rules = rules.filter((rule) => rule.enabled === enabled);
    }

    return {
      success: true,
      data: rules,
      count: rules.length,
      message: 'Routing rules retrieved successfully',
    };
  }

  /**
   * Get a specific routing rule
   */
  @Get('rules/:id')
  @ApiOperation({ summary: 'Get routing rule by ID' })
  @ApiResponse({ status: 200, description: 'Routing rule retrieved', type: RoutingRuleResponseDto })
  @ApiResponse({ status: 404, description: 'Routing rule not found' })
  async getRule(@Param('id') id: string): Promise<any> {
    const rule = this.routingConfig.getRule(id);

    if (!rule) {
      return {
        success: false,
        message: `Routing rule with ID ${id} not found`,
      };
    }

    return {
      success: true,
      data: rule,
      message: 'Routing rule retrieved successfully',
    };
  }

  /**
   * Create a new routing rule
   */
  @Post('rules')
  @ApiOperation({ summary: 'Create a new routing rule' })
  @ApiResponse({ status: 201, description: 'Routing rule created', type: RoutingRuleResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid routing rule data' })
  @HttpCode(HttpStatus.CREATED)
  async createRule(@Body() createDto: CreateRoutingRuleDto): Promise<any> {
    try {
      const rule: RoutingRule = {
        id: createDto.id,
        name: createDto.name,
        description: createDto.description,
        priority: createDto.priority,
        enabled: createDto.enabled ?? true,
        conditions: createDto.conditions,
        action: createDto.action,
        metadata: createDto.metadata,
      };

      await this.routingConfig.addRule(rule);

      return {
        success: true,
        data: rule,
        message: 'Routing rule created successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create routing rule: ${error.message}`,
      };
    }
  }

  /**
   * Update an existing routing rule
   */
  @Put('rules/:id')
  @ApiOperation({ summary: 'Update routing rule' })
  @ApiResponse({ status: 200, description: 'Routing rule updated' })
  @ApiResponse({ status: 404, description: 'Routing rule not found' })
  async updateRule(@Param('id') id: string, @Body() updateDto: UpdateRoutingRuleDto): Promise<any> {
    try {
      await this.routingConfig.updateRule(id, updateDto);

      return {
        success: true,
        message: 'Routing rule updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update routing rule: ${error.message}`,
      };
    }
  }

  /**
   * Delete a routing rule
   */
  @Delete('rules/:id')
  @ApiOperation({ summary: 'Delete routing rule' })
  @ApiResponse({ status: 200, description: 'Routing rule deleted' })
  @ApiResponse({ status: 404, description: 'Routing rule not found' })
  async deleteRule(@Param('id') id: string): Promise<any> {
    try {
      await this.routingConfig.removeRule(id);

      return {
        success: true,
        message: 'Routing rule deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete routing rule: ${error.message}`,
      };
    }
  }

  /**
   * Enable or disable a routing rule
   */
  @Put('rules/:id/toggle')
  @ApiOperation({ summary: 'Enable or disable routing rule' })
  @ApiResponse({ status: 200, description: 'Routing rule toggled' })
  async toggleRule(@Param('id') id: string, @Body() body: { enabled: boolean }): Promise<any> {
    try {
      await this.routingConfig.toggleRule(id, body.enabled);

      return {
        success: true,
        message: `Routing rule ${body.enabled ? 'enabled' : 'disabled'} successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to toggle routing rule: ${error.message}`,
      };
    }
  }

  /**
   * Test routing rules against a sample request
   */
  @Post('test')
  @ApiOperation({ summary: 'Test routing rules against sample request' })
  @ApiResponse({ status: 200, description: 'Routing test completed' })
  async testRouting(@Body() testRequest: any): Promise<any> {
    try {
      const context = {
        request: {
          method: testRequest.method || 'GET',
          path: testRequest.path || '/',
          headers: testRequest.headers || {},
          query: testRequest.query || {},
          body: testRequest.body,
          ip: testRequest.ip || '127.0.0.1',
          userAgent: testRequest.userAgent,
        },
        tenant: testRequest.tenant,
        user: testRequest.user,
        metadata: {
          timestamp: new Date().toISOString(),
          test: true,
        },
      };

      const result = await this.routingEngine.evaluateRouting(context);

      return {
        success: true,
        data: {
          matched: result.matched,
          rule: result.rule,
          action: result.action,
          transformedRequest: result.transformedRequest,
          metadata: result.metadata,
        },
        message: 'Routing test completed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Routing test failed: ${error.message}`,
      };
    }
  }

  /**
   * Get routing statistics and metrics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get routing statistics' })
  @ApiResponse({
    status: 200,
    description: 'Routing statistics retrieved',
    type: RoutingStatsResponseDto,
  })
  async getStats(): Promise<RoutingStatsResponseDto> {
    const stats = this.routingEngine.getStats();
    const rules = this.routingConfig.getRules();

    return {
      success: true,
      data: {
        ...stats,
        rulesByPriority: rules
          .sort((a, b) => b.priority - a.priority)
          .map((rule) => ({
            id: rule.id,
            name: rule.name,
            priority: rule.priority,
            enabled: rule.enabled,
          })),
        conditionTypes: this.getConditionTypeStats(rules),
        actionTypes: this.getActionTypeStats(rules),
      },
      message: 'Routing statistics retrieved successfully',
    };
  }

  /**
   * Clear routing cache
   */
  @Post('cache/clear')
  @ApiOperation({ summary: 'Clear routing cache' })
  @ApiResponse({ status: 200, description: 'Routing cache cleared' })
  async clearCache(): Promise<any> {
    this.routingEngine.clearCache();

    return {
      success: true,
      message: 'Routing cache cleared successfully',
    };
  }

  /**
   * Reload routing configuration from file
   */
  @Post('config/reload')
  @ApiOperation({ summary: 'Reload routing configuration from file' })
  @ApiResponse({ status: 200, description: 'Configuration reloaded' })
  async reloadConfig(): Promise<any> {
    try {
      await this.routingConfig.loadConfig();

      return {
        success: true,
        message: 'Routing configuration reloaded successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to reload configuration: ${error.message}`,
      };
    }
  }

  /**
   * Get condition type statistics
   */
  private getConditionTypeStats(rules: RoutingRule[]): Record<string, number> {
    const stats: Record<string, number> = {};

    rules.forEach((rule) => {
      rule.conditions.forEach((condition) => {
        stats[condition.type] = (stats[condition.type] || 0) + 1;
      });
    });

    return stats;
  }

  /**
   * Get action type statistics
   */
  private getActionTypeStats(rules: RoutingRule[]): Record<string, number> {
    const stats: Record<string, number> = {};

    rules.forEach((rule) => {
      stats[rule.action.type] = (stats[rule.action.type] || 0) + 1;
    });

    return stats;
  }
}
