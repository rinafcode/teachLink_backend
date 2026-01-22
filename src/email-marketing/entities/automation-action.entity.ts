import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { AutomationWorkflow } from './automation-workflow.entity';
import { ActionType } from '../enums/action-type.enum';

@Entity('automation_actions')
export class AutomationAction {
    @ApiProperty()
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ApiProperty()
    @Column()
    workflowId: string;

    @ManyToOne(() => AutomationWorkflow, (workflow) => workflow.actions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'workflowId' })
    workflow: AutomationWorkflow;

    @ApiProperty({ enum: ActionType })
    @Column({ type: 'enum', enum: ActionType })
    type: ActionType;

    @ApiProperty()
    @Column({ type: 'jsonb' })
    config: Record<string, any>;

    @ApiProperty()
    @Column({ default: 0 })
    order: number;

    @ApiProperty({ required: false })
    @Column({ type: 'text', nullable: true })
    description?: string;
}
