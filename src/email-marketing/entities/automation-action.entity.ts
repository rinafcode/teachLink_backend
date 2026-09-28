import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AutomationWorkflow } from './automation-workflow.entity';
import { ActionType } from '../enums/action-type.enum';

/**
 * Represents the automation Action entity.
 */
@Entity('automation_actions')
@Index('IDX_automation_actions_workflowId_order', ['workflowId', 'order'])
@Index('IDX_automation_actions_workflowId_type', ['workflowId', 'type'])
export class AutomationAction {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @ApiProperty()
  @Index('IDX_automation_actions_workflowId')
  @Column()
  workflowId: string;

  @ManyToOne(() => AutomationWorkflow, (workflow) => workflow.actions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflowId' })
  workflow: AutomationWorkflow;

  @ApiProperty({ enum: ActionType })
  @Index('IDX_automation_actions_type')
  @Column({ type: 'enum', enum: ActionType })
  type: ActionType;

  @ApiProperty()
  @Column({ type: 'jsonb' })
  config: Record<string, any>;

  @ApiProperty()
  @Index('IDX_automation_actions_order')
  @Column({ default: 0 })
  order: number;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Index('IDX_automation_actions_deletedAt')
  @DeleteDateColumn()
  deletedAt?: Date;
}
