import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { AutomationTrigger } from './automation-trigger.entity';
import { AutomationAction } from './automation-action.entity';
import { WorkflowStatus } from '../enums/workflow-status.enum';

@Entity('automation_workflows')
export class AutomationWorkflow {
    @ApiProperty()
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ApiProperty()
    @Column()
    name: string;

    @ApiProperty({ required: false })
    @Column({ type: 'text', nullable: true })
    description?: string;

    @ApiProperty({ enum: WorkflowStatus })
    @Column({ type: 'enum', enum: WorkflowStatus, default: WorkflowStatus.DRAFT })
    status: WorkflowStatus;

    @OneToMany(() => AutomationTrigger, (trigger) => trigger.workflow, { cascade: true })
    triggers: AutomationTrigger[];

    @OneToMany(() => AutomationAction, (action) => action.workflow, { cascade: true })
    actions: AutomationAction[];

    @ApiProperty()
    @Column({ default: 0 })
    executionCount: number;

    @ApiProperty({ required: false })
    @Column({ nullable: true })
    lastExecutedAt?: Date;

    @ApiProperty({ required: false })
    @Column({ nullable: true })
    activatedAt?: Date;

    @ApiProperty({ required: false })
    @Column({ nullable: true })
    deactivatedAt?: Date;

    @ApiProperty()
    @CreateDateColumn()
    createdAt: Date;

    @ApiProperty()
    @UpdateDateColumn()
    updatedAt: Date;
}
