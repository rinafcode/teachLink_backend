import { Injectable, Logger } from '@nestjs/common';

interface WorkflowStep {
  name: string;
  execute: () => Promise<void>;
  compensate?: () => Promise<void>;
}

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  async executeWorkflow(steps: WorkflowStep[]) {
    const completedSteps: WorkflowStep[] = [];

    try {
      for (const step of steps) {
        await step.execute();
        completedSteps.push(step);
      }
    } catch (error) {
      this.logger.error('Workflow failed. Triggering compensation.');
      
      for (const step of completedSteps.reverse()) {
        if (step.compensate) {
          await step.compensate();
        }
      }

      throw error;
    }
  }
}