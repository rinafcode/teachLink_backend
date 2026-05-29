import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { IncidentManagementService } from './incident-management.service';
import {
  CreateIncidentDto,
  UpdateIncidentDto,
  GetIncidentsQueryDto,
  IncidentResponseDto,
  CreateRemediationActionDto,
  RemediationActionResponseDto,
  CreateRunbookExecutionDto,
  RunbookExecutionResponseDto,
} from './dto';
import { Incident } from './entities/incident.entity';
import { RemediationAction } from './entities/remediation-action.entity';
import { RunbookExecution } from './entities/runbook-execution.entity';

@Controller('incidents')
export class IncidentManagementController {
  private readonly logger = new Logger(IncidentManagementController.name);

  constructor(private incidentManagementService: IncidentManagementService) {}

  /**
   * Create a new incident manually
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createIncident(
    @Body() createIncidentDto: CreateIncidentDto,
  ): Promise<IncidentResponseDto> {
    this.logger.log(`Creating incident: ${createIncidentDto.title}`);
    const incident = await this.incidentManagementService.createIncident(
      createIncidentDto,
    );
    return this.mapIncidentToDto(incident);
  }

  /**
   * Get all incidents
   */
  @Get()
  async getIncidents(
    @Query() query: GetIncidentsQueryDto,
  ): Promise<{ data: IncidentResponseDto[]; total: number }> {
    const result = await this.incidentManagementService.getIncidents(query);
    return {
      data: result.data.map((incident) => this.mapIncidentToDto(incident)),
      total: result.total,
    };
  }

  /**
   * Get incident by ID
   */
  @Get(':incidentId')
  async getIncidentById(
    @Param('incidentId') incidentId: string,
  ): Promise<IncidentResponseDto> {
    const incident = await this.incidentManagementService.getIncidentById(
      incidentId,
    );
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }
    return this.mapIncidentToDto(incident);
  }

  /**
   * Update incident
   */
  @Put(':incidentId')
  async updateIncident(
    @Param('incidentId') incidentId: string,
    @Body() updateIncidentDto: UpdateIncidentDto,
  ): Promise<IncidentResponseDto> {
    const incident = await this.incidentManagementService.updateIncident(
      incidentId,
      updateIncidentDto,
    );
    return this.mapIncidentToDto(incident);
  }

  /**
   * Resolve incident
   */
  @Post(':incidentId/resolve')
  async resolveIncident(
    @Param('incidentId') incidentId: string,
    @Body() body: { resolutionNotes: string },
  ): Promise<IncidentResponseDto> {
    this.logger.log(`Resolving incident: ${incidentId}`);
    const incident = await this.incidentManagementService.resolveIncident(
      incidentId,
      body.resolutionNotes,
    );
    return this.mapIncidentToDto(incident);
  }

  /**
   * Escalate incident
   */
  @Post(':incidentId/escalate')
  async escalateIncident(
    @Param('incidentId') incidentId: string,
    @Body() body: { escalatedTo: string; reason: string },
  ): Promise<IncidentResponseDto> {
    this.logger.log(`Escalating incident: ${incidentId}`);
    const incident = await this.incidentManagementService.escalateIncident(
      incidentId,
      body.escalatedTo,
      body.reason,
    );
    return this.mapIncidentToDto(incident);
  }

  /**
   * Create remediation action
   */
  @Post(':incidentId/remediation-actions')
  @HttpCode(HttpStatus.CREATED)
  async createRemediationAction(
    @Param('incidentId') incidentId: string,
    @Body() createDto: CreateRemediationActionDto,
  ): Promise<RemediationActionResponseDto> {
    this.logger.log(`Creating remediation action for incident: ${incidentId}`);
    const remediationAction =
      await this.incidentManagementService.createRemediationAction({
        ...createDto,
        incidentId,
      });
    return this.mapRemediationActionToDto(remediationAction);
  }

  /**
   * Get remediation actions for incident
   */
  @Get(':incidentId/remediation-actions')
  async getRemediationActions(
    @Param('incidentId') incidentId: string,
  ): Promise<RemediationActionResponseDto[]> {
    const actions =
      await this.incidentManagementService.getRemediationActionsForIncident(
        incidentId,
      );
    return actions.map((action) => this.mapRemediationActionToDto(action));
  }

  /**
   * Execute runbook for incident
   */
  @Post(':incidentId/runbook-executions')
  @HttpCode(HttpStatus.CREATED)
  async executeRunbook(
    @Param('incidentId') incidentId: string,
    @Body() createDto: CreateRunbookExecutionDto,
  ): Promise<RunbookExecutionResponseDto> {
    this.logger.log(`Executing runbook for incident: ${incidentId}`);
    const execution = await this.incidentManagementService.executeRunbookForIncident(
      incidentId,
      createDto.runbookName,
    );
    return this.mapRunbookExecutionToDto(execution);
  }

  /**
   * Get runbook executions for incident
   */
  @Get(':incidentId/runbook-executions')
  async getRunbookExecutions(
    @Param('incidentId') incidentId: string,
  ): Promise<RunbookExecutionResponseDto[]> {
    const executions =
      await this.incidentManagementService.getRunbookExecutionsForIncident(
        incidentId,
      );
    return executions.map((execution) => this.mapRunbookExecutionToDto(execution));
  }

  /**
   * List available runbooks
   */
  @Get('runbooks/available')
  async listAvailableRunbooks(): Promise<string[]> {
    return this.incidentManagementService.listAvailableRunbooks();
  }

  /**
   * Get incident management statistics
   */
  @Get('statistics/overview')
  async getStatistics() {
    return this.incidentManagementService.getStatistics();
  }

  /**
   * Mapper functions
   */
  private mapIncidentToDto(incident: Incident): IncidentResponseDto {
    return {
      id: incident.id,
      title: incident.title,
      description: incident.description,
      status: incident.status,
      severity: incident.severity,
      triggerMetrics: incident.triggerMetrics,
      runbookId: incident.runbookId,
      remediationActionIds: incident.remediationActionIds,
      escalatedTo: incident.escalatedTo,
      resolvedAt: incident.resolvedAt,
      resolutionNotes: incident.resolutionNotes,
      detectedAt: incident.detectedAt,
      updatedAt: incident.updatedAt,
    };
  }

  private mapRemediationActionToDto(
    action: RemediationAction,
  ): RemediationActionResponseDto {
    return {
      id: action.id,
      incidentId: action.incidentId,
      actionType: action.actionType,
      description: action.description,
      status: action.status,
      parameters: action.parameters,
      executedAt: action.executedAt,
      executionOutput: action.executionOutput,
      errorMessage: action.errorMessage,
      autoRollback: action.autoRollback,
      rolledBackAt: action.rolledBackAt,
      createdAt: action.createdAt,
      updatedAt: action.updatedAt,
    };
  }

  private mapRunbookExecutionToDto(
    execution: RunbookExecution,
  ): RunbookExecutionResponseDto {
    return {
      id: execution.id,
      incidentId: execution.incidentId,
      runbookName: execution.runbookName,
      runbookPath: execution.runbookPath,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      stepExecutions: execution.stepExecutions,
      executionSummary: execution.executionSummary,
      errorDetails: execution.errorDetails,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
    };
  }
}
