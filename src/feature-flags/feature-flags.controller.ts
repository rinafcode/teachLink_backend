import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FlagEvaluationService } from '../evaluation/flag-evaluation.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/entities/user.entity';
import { IFeatureFlag, IUserContext } from '../interfaces';

interface ICreateFlagDto {
  key: string;
  description?: string;
  enabled?: boolean;
  valueType?: 'boolean' | 'string' | 'number' | 'json';
  defaultValue?: any;
  variations?: Array<{ key: string; value: any }>;
  defaultVariationKey?: string;
  offVariationKey?: string;
}

interface IUpdateFlagDto {
  description?: string;
  enabled?: boolean;
  defaultValue?: any;
  variations?: Array<{ key: string; value: any }>;
  defaultVariationKey?: string;
  offVariationKey?: string;
  targeting?: any;
  rollout?: any;
  experiment?: any;
}

interface IEvaluateFlagDto {
  userId: string;
  sessionId?: string;
  email?: string;
  attributes?: Record<string, any>;
}

@ApiTags('feature-flags')
@Controller('feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FeatureFlagsController {
  constructor(private readonly flagEvaluationService: FlagEvaluationService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all feature flags' })
  getAllFlags(): IFeatureFlag[] {
    return this.flagEvaluationService.getAllFlags();
  }

  @Get(':key')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a specific feature flag' })
  getFlag(@Param('key') key: string): IFeatureFlag | undefined {
    return this.flagEvaluationService.getFlag(key);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new feature flag' })
  createFlag(@Body() dto: ICreateFlagDto): { message: string; flag: IFeatureFlag } {
    const flag: IFeatureFlag = {
      id: `flag_${Date.now()}`,
      key: dto.key,
      description: dto.description || '',
      enabled: dto.enabled !== false,
      archived: false,
      valueType: dto.valueType || 'boolean',
      variations: dto.variations || [
        { key: 'on', value: dto.defaultValue ?? true },
        { key: 'off', value: dto.defaultValue ?? false },
      ],
      defaultValue: dto.defaultValue ?? false,
      defaultVariationKey: dto.defaultVariationKey || 'on',
      offVariationKey: dto.offVariationKey || 'off',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.flagEvaluationService.setFlag(flag);

    return { message: 'Feature flag created successfully', flag };
  }

  @Put(':key')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a feature flag' })
  updateFlag(
    @Param('key') key: string,
    @Body() dto: IUpdateFlagDto,
  ): { message: string; flag: IFeatureFlag | null } {
    const updated = this.flagEvaluationService.updateFlag(key, dto);

    return {
      message: updated ? 'Feature flag updated successfully' : 'Feature flag not found',
      flag: updated,
    };
  }

  @Delete(':key')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a feature flag' })
  deleteFlag(@Param('key') key: string): { message: string } {
    const deleted = this.flagEvaluationService.removeFlag(key);

    return {
      message: deleted ? 'Feature flag deleted successfully' : 'Feature flag not found',
    };
  }

  @Post(':key/enable')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Enable a feature flag' })
  enableFlag(@Param('key') key: string): { message: string } {
    const flag = this.flagEvaluationService.getFlag(key);
    if (!flag) {
      return { message: 'Feature flag not found' };
    }

    this.flagEvaluationService.updateFlag(key, { enabled: true });
    return { message: `Feature flag ${key} enabled` };
  }

  @Post(':key/disable')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Disable a feature flag' })
  disableFlag(@Param('key') key: string): { message: string } {
    const flag = this.flagEvaluationService.getFlag(key);
    if (!flag) {
      return { message: 'Feature flag not found' };
    }

    this.flagEvaluationService.updateFlag(key, { enabled: false });
    return { message: `Feature flag ${key} disabled` };
  }

  @Post('evaluate')
  @ApiOperation({ summary: 'Evaluate a feature flag for a user' })
  evaluateFlag(
    @Query('key') key: string,
    @Body() dto: IEvaluateFlagDto,
  ) {
    const userContext: IUserContext = {
      userId: dto.userId,
      sessionId: dto.sessionId,
      email: dto.email,
      attributes: dto.attributes || {},
    };

    return this.flagEvaluationService.evaluate(key, userContext);
  }

  @Post('evaluate-all')
  @ApiOperation({ summary: 'Evaluate all feature flags for a user' })
  evaluateAllFlags(@Body() dto: IEvaluateFlagDto) {
    const userContext: IUserContext = {
      userId: dto.userId,
      sessionId: dto.sessionId,
      email: dto.email,
      attributes: dto.attributes || {},
    };

    return this.flagEvaluationService.evaluateAll(userContext);
  }
}
