import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { AutomationWorkflow } from './automation-workflow.entity';
import { TriggerType } from '../enums/trigger-type.enum';

@Entity('automation_triggers')
export class AutomationTrigger {
    @ApiProperty()
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ApiProperty()
    @Column()
    workflowId: string;

    @ManyToOne(() => AutomationWorkflow, (workflow) => workflow.triggers, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'workflowId' })
    workflow: AutomationWorkflow;

    @ApiProperty({ enum: TriggerType })
    @Column({ type: 'enum', enum: TriggerType })
    type: TriggerType;

    @ApiProperty({ required: false })
    @Column({ type: 'jsonb', nullable: true })
    conditions?: Record<string, any>;

    @ApiProperty({ required: false })
    @Column({ type: 'text', nullable: true })
    description?: string;
}
