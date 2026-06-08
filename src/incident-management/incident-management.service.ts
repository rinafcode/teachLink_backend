import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Incident, IncidentStatus, IncidentSeverity } from './entities/incident.entity';
import { RemediationAction, RemediationStatus } from './entities/remediation-action.entity';
import { RunbookExecution } from './entities/runbook-execution.entity';
import { IncidentDetectionService } from './services/incident-detection.service';
import { AutoRemediationService } from './services/auto-remediation.service';
import { RunbookExecutionService } from './services/runbook-execution.service';
import { NotificationAndEscalationService } from './services/notification-and-escalation.service';
import {
  CreateIncidentDto,
  UpdateIncidentDto,
  GetIncidentsQueryDto,
  CreateRemediationActionDto,
  CreateRunbookExecutionDto,
} from './dto';
import { IAlertEvent } from '../monitoring/alerting/alerting.service';

@Injectable()
export class IncidentManagementService {
  private readonly logger = new Logger(IncidentManagementService.name);

  constructor(
    @InjectRepository(Incident)
    private incidentRepository: Repository<Incident>,
    @InjectRepository(RemediationAction)
    private remediationRepository: Repository<RemediationAction>,
    @InjectRepository(RunbookExecution)
    private runbookRepository: Repository<RunbookExecution>,
    private incidentDetectionService: IncidentDetectionService,
    private autoRemediationService: AutoRemediationService,
    private runbookExecutionService: RunbookExecutionService,
    private notificationService: NotificationAndEscalationService,
  ) {}

  /**
   * Process incoming alert and trigger incident management workflow
   */
  async processAlert(alert: IAlertEvent): Promise<Incident | null> {
    this.logger.debug(`Processing alert: ${alert.type}`);

    // 1. INCIDENT DETECTION
    const incident = await this.incidentDetectionService.processAlert(alert);
    if (!incident) {
      this.logger.debug('No incident created from alert');
      return null;
    }

    this.logger.warn(`Incident detected: ${incident.id} - ${incident.title}`);

    // 2. NOTIFY INCIDENT DETECTION
    await this.notificationService.notifyIncidentDetected(incident);

    // 3. AUTOMATIC REMEDIATION
    if (incident.severity !== IncidentSeverity.INFO) {
      await this.executeAutoRemediation(incident);
    }

    // 4. RUNBOOK EXECUTION
    if (incident.runbookId) {
      await this.executeRunbook(incident);
    }

    return incident;
  }

  /**
   * Execute automatic remediation actions for an incident
   */
  private async executeAutoRemediation(incident: Incident): Promise<void> {
    try {
      const suggestedActions =
        this.autoRemediationService.suggestRemediationActions(incident.title);

      if (suggestedActions.length === 0) {
        this.logger.debug(`No suggested remediation actions for: ${incident.title}`);
        return;
      }

      const remediationIds: string[] = [];

      for (const suggestion of suggestedActions) {
        const remediationAction = await this.autoRemediationService.executeRemediationAction(
          incident,
          suggestion.actionType,
          suggestion.description,
          suggestion.parameters,
          suggestion.autoRollback,
        );

        remediationIds.push(remediationAction.id);

        // Notify remediation action execution
        await this.notificationService.notifyRemediationExecuted(
          incident,
          remediationAction,
        );

        // Auto-rollback on failure if configured
        if (
          suggestion.autoRollback &&
          remediationAction.status === RemediationStatus.FAILED
        ) {
          this.logger.log(
            `Auto-rolling back failed remediation action: ${remediationAction.id}`,
          );
          await this.autoRemediationService.rollbackRemediationAction(
            remediationAction,
          );
        }
      }

      // Update incident with remediation action IDs
      incident.remediationActionIds = remediationIds;
      await this.incidentRepository.save(incident);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error executing auto remediation: ${errorMsg}`);
    }
  }

  /**
   * Execute runbook for an incident
   */
  private async executeRunbook(incident: Incident): Promise<void> {
    try {
      if (!incident.runbookId) {
        this.logger.debug(`No runbook configured for incident: ${incident.id}`);
        return;
      }

      const runbookExecution = await this.runbookExecutionService.executeRunbook(
        incident,
        incident.runbookId,
      );

      this.logger.log(
        `Runbook execution completed: ${runbookExecution.id} - ${runbookExecution.status}`,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error executing runbook: ${errorMsg}`);
    }
  }

  /**
   * Create incident manually
   */
  async createIncident(createIncidentDto: CreateIncidentDto): Promise<Incident> {
    this.logger.log(`Creating incident: ${createIncidentDto.title}`);

    const incident = this.incidentRepository.create(createIncidentDto);
    return this.incidentRepository.save(incident);
  }

  /**
   * Update incident
   */
  async updateIncident(
    incidentId: string,
    updateIncidentDto: UpdateIncidentDto,
  ): Promise<Incident> {
    const incident = await this.getIncidentById(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    Object.assign(incident, updateIncidentDto);

    // Set resolved timestamp if status changed to resolved
    if (
      updateIncidentDto.status === IncidentStatus.RESOLVED &&
      incident.resolvedAt === null
    ) {
      incident.resolvedAt = new Date();
    }

    return this.incidentRepository.save(incident);
  }

  /**
   * Get incident by ID
   */
  async getIncidentById(incidentId: string): Promise<Incident | null> {
    return this.incidentRepository.findOne({ where: { id: incidentId } });
  }

  /**
   * Get all incidents with filtering
   */
  async getIncidents(query: GetIncidentsQueryDto): Promise<{
    data: Incident[];
    total: number;
  }> {
    const qb = this.incidentRepository.createQueryBuilder('incident');

    if (query.status) {
      qb.andWhere('incident.status = :status', { status: query.status });
    }

    if (query.severity) {
      qb.andWhere('incident.severity = :severity', { severity: query.severity });
    }

    const [data, total] = await qb
      .orderBy('incident.detectedAt', 'DESC')
      .skip(query.skip)
      .take(query.take)
      .getManyAndCount();

    return { data, total };
  }

  /**
   * Resolve incident manually
   */
  async resolveIncident(
    incidentId: string,
    resolutionNotes: string,
  ): Promise<Incident> {
    const incident = await this.getIncidentById(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    const resolutionTime = Date.now() - incident.detectedAt.getTime();

    incident.status = IncidentStatus.RESOLVED;
    incident.resolvedAt = new Date();
    incident.resolutionNotes = resolutionNotes;

    const updatedIncident = await this.incidentRepository.save(incident);

    // Notify incident resolution
    await this.notificationService.notifyIncidentResolved(
      updatedIncident,
      resolutionTime,
    );

    this.logger.log(
      `Incident resolved: ${incidentId} (Resolution time: ${(resolutionTime / 1000 / 60).toFixed(2)}m)`,
    );

    return updatedIncident;
  }

  /**
   * Escalate incident
   */
  async escalateIncident(
    incidentId: string,
    escalatedTo: string,
    reason: string,
  ): Promise<Incident> {
    const incident = await this.getIncidentById(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    incident.status = IncidentStatus.ESCALATED;
    incident.escalatedTo = escalatedTo;

    const updatedIncident = await this.incidentRepository.save(incident);

    // Notify escalation
    await this.notificationService.escalateIncident(
      updatedIncident,
      escalatedTo,
      reason,
    );

    this.logger.log(`Incident escalated: ${incidentId} to ${escalatedTo}`);

    return updatedIncident;
  }

  /**
   * Create remediation action manually
   */
  async createRemediationAction(
    createDto: CreateRemediationActionDto,
  ): Promise<RemediationAction> {
    const incident = await this.getIncidentById(createDto.incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${createDto.incidentId}`);
    }

    return this.autoRemediationService.executeRemediationAction(
      incident,
      createDto.actionType,
      createDto.description,
      createDto.parameters || {},
      createDto.autoRollback || false,
    );
  }

  /**
   * Get remediation actions for an incident
   */
  async getRemediationActionsForIncident(
    incidentId: string,
  ): Promise<RemediationAction[]> {
    return this.autoRemediationService.getRemediationActions(incidentId);
  }

  /**
   * Execute runbook for an incident
   */
  async executeRunbookForIncident(
    incidentId: string,
    runbookName: string,
  ): Promise<RunbookExecution> {
    const incident = await this.getIncidentById(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    return this.runbookExecutionService.executeRunbook(incident, runbookName);
  }

  /**
   * Get runbook executions for an incident
   */
  async getRunbookExecutionsForIncident(
    incidentId: string,
  ): Promise<RunbookExecution[]> {
    return this.runbookExecutionService.getRunbookExecutionsForIncident(
      incidentId,
    );
  }

  /**
   * List available runbooks
   */
  async listAvailableRunbooks(): Promise<string[]> {
    return this.runbookExecutionService.listAvailableRunbooks();
  }

  /**
   * Get incident management statistics
   */
  async getStatistics(): Promise<{
    totalIncidents: number;
    activeIncidents: number;
    resolvedIncidents: number;
    escalatedIncidents: number;
    incidentsBySeverity: Record<string, number>;
    detectionStats: {
      totalAlerts: number;
      alertTypes: Record<string, number>;
      detectionRules: number;
    };
  }> {
    const totalIncidents = await this.incidentRepository.count();
    const activeIncidents = await this.incidentRepository.countBy({
      status: IncidentStatus.IN_PROGRESS,
    });
    const resolvedIncidents = await this.incidentRepository.countBy({
      status: IncidentStatus.RESOLVED,
    });
    const escalatedIncidents = await this.incidentRepository.countBy({
      status: IncidentStatus.ESCALATED,
    });

    const severityStats = await this.incidentRepository
      .createQueryBuilder('incident')
      .select('incident.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .groupBy('incident.severity')
      .getRawMany();

    const incidentsBySeverity: Record<string, number> = {};
    for (const stat of severityStats) {
      incidentsBySeverity[stat.severity] = parseInt(stat.count, 10);
    }

    const detectionStats = await this.incidentDetectionService.getDetectionStats();

    return {
      totalIncidents,
      activeIncidents,
      resolvedIncidents,
      escalatedIncidents,
      incidentsBySeverity,
      detectionStats,
    };
  }
}
