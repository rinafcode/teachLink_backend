import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { AutomationWorkflow } from '../entities/automation-workflow.entity';
import { AutomationTrigger } from '../entities/automation-trigger.entity';
import { AutomationAction } from '../entities/automation-action.entity';

import { CreateAutomationDto } from '../dto/create-automation.dto';
import { UpdateAutomationDto } from '../dto/update-automation.dto';
import { TriggerType } from '../enums/trigger-type.enum';
import { ActionType } from '../enums/action-type.enum';
import { WorkflowStatus } from '../enums/workflow-status.enum';

@Injectable()
export class AutomationService {
    constructor(
        @InjectRepository(AutomationWorkflow)
        private readonly workflowRepository: Repository<AutomationWorkflow>,
        @InjectRepository(AutomationTrigger)
        private readonly triggerRepository: Repository<AutomationTrigger>,
        @InjectRepository(AutomationAction)
        private readonly actionRepository: Repository<AutomationAction>,
        @InjectQueue('email-marketing')
        private readonly emailQueue: Queue,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * Create a new automation workflow
     */
    async create(createAutomationDto: CreateAutomationDto): Promise<AutomationWorkflow> {
        const workflow = this.workflowRepository.create({
            name: createAutomationDto.name,
            description: createAutomationDto.description,
            status: WorkflowStatus.DRAFT,
        });

        const savedWorkflow = await this.workflowRepository.save(workflow);

        // Create triggers
        if (createAutomationDto.triggers?.length) {
            const triggers = createAutomationDto.triggers.map((trigger) =>
                this.triggerRepository.create({
                    ...trigger,
                    workflowId: savedWorkflow.id,
                }),
            );
            await this.triggerRepository.save(triggers);
        }

        // Create actions
        if (createAutomationDto.actions?.length) {
            const actions = createAutomationDto.actions.map((action, index) =>
                this.actionRepository.create({
                    ...action,
                    workflowId: savedWorkflow.id,
                    order: index,
                }),
            );
            await this.actionRepository.save(actions);
        }

        return this.findOne(savedWorkflow.id);
    }

    /**
     * Get all automation workflows
     */
    async findAll(page: number = 1, limit: number = 10): Promise<{
        workflows: AutomationWorkflow[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const [workflows, total] = await this.workflowRepository.findAndCount({
            skip: (page - 1) * limit,
            take: limit,
            order: { createdAt: 'DESC' },
            relations: ['triggers', 'actions'],
        });

        return {
            workflows,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get a single workflow by ID
     */
    async findOne(id: string): Promise<AutomationWorkflow> {
        const workflow = await this.workflowRepository.findOne({
            where: { id },
            relations: ['triggers', 'actions'],
        });

        if (!workflow) {
            throw new NotFoundException(`Automation workflow with ID ${id} not found`);
        }

        return workflow;
    }

    /**
     * Update a workflow
     */
    async update(id: string, updateAutomationDto: UpdateAutomationDto): Promise<AutomationWorkflow> {
        const workflow = await this.findOne(id);

        if (workflow.status === WorkflowStatus.ACTIVE) {
            throw new BadRequestException('Deactivate workflow before making changes');
        }

        Object.assign(workflow, {
            name: updateAutomationDto.name ?? workflow.name,
            description: updateAutomationDto.description ?? workflow.description,
        });

        await this.workflowRepository.save(workflow);

        // Update triggers if provided
        if (updateAutomationDto.triggers) {
            await this.triggerRepository.delete({ workflowId: id });
            const triggers = updateAutomationDto.triggers.map((trigger) =>
                this.triggerRepository.create({
                    ...trigger,
                    workflowId: id,
                }),
            );
            await this.triggerRepository.save(triggers);
        }

        // Update actions if provided
        if (updateAutomationDto.actions) {
            await this.actionRepository.delete({ workflowId: id });
            const actions = updateAutomationDto.actions.map((action, index) =>
                this.actionRepository.create({
                    ...action,
                    workflowId: id,
                    order: index,
                }),
            );
            await this.actionRepository.save(actions);
        }

        return this.findOne(id);
    }

    /**
     * Delete a workflow
     */
    async remove(id: string): Promise<void> {
        const workflow = await this.findOne(id);

        if (workflow.status === WorkflowStatus.ACTIVE) {
            throw new BadRequestException('Deactivate workflow before deleting');
        }

        await this.workflowRepository.remove(workflow);
    }

    /**
     * Activate a workflow
     */
    async activate(id: string): Promise<AutomationWorkflow> {
        const workflow = await this.findOne(id);

        if (!workflow.triggers?.length) {
            throw new BadRequestException('Workflow must have at least one trigger');
        }

        if (!workflow.actions?.length) {
            throw new BadRequestException('Workflow must have at least one action');
        }

        workflow.status = WorkflowStatus.ACTIVE;
        workflow.activatedAt = new Date();

        return this.workflowRepository.save(workflow);
    }

    /**
     * Deactivate a workflow
     */
    async deactivate(id: string): Promise<AutomationWorkflow> {
        const workflow = await this.findOne(id);
        workflow.status = WorkflowStatus.INACTIVE;
        workflow.deactivatedAt = new Date();

        return this.workflowRepository.save(workflow);
    }

    /**
     * Handle user signup event
     */
    @OnEvent('user.signup')
    async handleUserSignup(payload: { userId: string; email: string }) {
        await this.executeTriggeredWorkflows(TriggerType.USER_SIGNUP, payload);
    }

    /**
     * Handle course enrollment event
     */
    @OnEvent('course.enrolled')
    async handleCourseEnrollment(payload: { userId: string; courseId: string }) {
        await this.executeTriggeredWorkflows(TriggerType.COURSE_ENROLLED, payload);
    }

    /**
     * Handle course completion event
     */
    @OnEvent('course.completed')
    async handleCourseCompletion(payload: { userId: string; courseId: string }) {
        await this.executeTriggeredWorkflows(TriggerType.COURSE_COMPLETED, payload);
    }

    /**
     * Handle purchase event
     */
    @OnEvent('payment.completed')
    async handlePurchase(payload: { userId: string; amount: number; productId: string }) {
        await this.executeTriggeredWorkflows(TriggerType.PURCHASE_MADE, payload);
    }

    /**
     * Handle user inactivity (called by scheduled job)
     */
    async handleUserInactivity(payload: { userId: string; daysSinceLastActivity: number }) {
        await this.executeTriggeredWorkflows(TriggerType.USER_INACTIVE, payload);
    }

    /**
     * Execute workflows that match the trigger type
     */
    private async executeTriggeredWorkflows(
        triggerType: TriggerType,
        payload: Record<string, any>,
    ): Promise<void> {
        // Find all active workflows with matching trigger
        const triggers = await this.triggerRepository.find({
            where: { type: triggerType },
            relations: ['workflow', 'workflow.actions'],
        });

        for (const trigger of triggers) {
            if (trigger.workflow.status !== WorkflowStatus.ACTIVE) {
                continue;
            }

            // Check trigger conditions
            if (this.evaluateTriggerConditions(trigger, payload)) {
                await this.executeWorkflowActions(trigger.workflow, payload);
            }
        }
    }

    /**
     * Evaluate trigger conditions
     */
    private evaluateTriggerConditions(
        trigger: AutomationTrigger,
        payload: Record<string, any>,
    ): boolean {
        if (!trigger.conditions || Object.keys(trigger.conditions).length === 0) {
            return true;
        }

        // Simple condition matching
        for (const [key, value] of Object.entries(trigger.conditions)) {
            if (payload[key] !== value) {
                return false;
            }
        }

        return true;
    }

    /**
     * Execute workflow actions in order
     */
    private async executeWorkflowActions(
        workflow: AutomationWorkflow,
        payload: Record<string, any>,
    ): Promise<void> {
        const sortedActions = workflow.actions.sort((a, b) => a.order - b.order);

        for (const action of sortedActions) {
            await this.executeAction(action, payload);
        }

        // Update workflow stats
        workflow.executionCount = (workflow.executionCount || 0) + 1;
        workflow.lastExecutedAt = new Date();
        await this.workflowRepository.save(workflow);
    }

    /**
     * Execute a single action
     */
    private async executeAction(
        action: AutomationAction,
        payload: Record<string, any>,
    ): Promise<void> {
        switch (action.type) {
            case ActionType.SEND_EMAIL:
                await this.emailQueue.add('send-automation-email', {
                    actionId: action.id,
                    templateId: action.config.templateId,
                    userId: payload.userId,
                    variables: { ...payload, ...action.config.variables },
                });
                break;

            case ActionType.WAIT:
                await this.emailQueue.add(
                    'continue-automation',
                    {
                        workflowId: action.workflowId,
                        nextActionOrder: action.order + 1,
                        payload,
                    },
                    { delay: action.config.delayMs || 0 },
                );
                break;

            case ActionType.ADD_TAG:
                this.eventEmitter.emit('user.addTag', {
                    userId: payload.userId,
                    tag: action.config.tag,
                });
                break;

            case ActionType.REMOVE_TAG:
                this.eventEmitter.emit('user.removeTag', {
                    userId: payload.userId,
                    tag: action.config.tag,
                });
                break;

            case ActionType.ADD_TO_SEGMENT:
                this.eventEmitter.emit('segment.addUser', {
                    userId: payload.userId,
                    segmentId: action.config.segmentId,
                });
                break;

            case ActionType.WEBHOOK:
                await this.emailQueue.add('call-webhook', {
                    url: action.config.webhookUrl,
                    method: action.config.method || 'POST',
                    payload: { ...payload, ...action.config.webhookPayload },
                });
                break;

            default:
                console.warn(`Unknown action type: ${action.type}`);
        }
    }

    /**
     * Get workflow execution statistics
     */
    async getWorkflowStats(id: string): Promise<{
        executionCount: number;
        lastExecutedAt: Date | null;
        emailsSent: number;
        openRate: number;
        clickRate: number;
    }> {
        const workflow = await this.findOne(id);

        // TODO: Calculate email stats from analytics
        return {
            executionCount: workflow.executionCount || 0,
            lastExecutedAt: workflow.lastExecutedAt,
            emailsSent: 0,
            openRate: 0,
            clickRate: 0,
        };
    }
}
