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
import { TriggerType } from '../enums/trigger-type.enum';

/**
 * Represents the automation Trigger entity.
 */
@Entity('automation_triggers')
@Index('IDX_automation_triggers_workflowId', ['workflowId'])
@Index('IDX_automation_triggers_type', ['type'])
export class AutomationTrigger {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

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

  @DeleteDateColumn()
  deletedAt?: Date;
}
