import { Injectable } from '@nestjs/common';

interface AutomationWorkflow {
  id: string;
  name: string;
  triggerEvent: string;
  actions: string[];
  enabled: boolean;
}

@Injectable()
export class AutomationService {
  private workflows: AutomationWorkflow[] = [];

  createWorkflow(workflow: Omit<AutomationWorkflow, 'id'>): AutomationWorkflow {
    const newWorkflow: AutomationWorkflow = {
      ...workflow,
      id: Math.random().toString(36).substring(2),
    };
    this.workflows.push(newWorkflow);
    return newWorkflow;
  }

  /**
   * Triggers all enabled workflows for a given event and executes their actions.
   * Returns an array of results for each workflow triggered.
   */
  triggerWorkflow(
    event: string,
    payload: any,
  ): { workflow: AutomationWorkflow; actionResults: any[] }[] {
    const triggered = this.workflows.filter(
      (wf) => wf.enabled && wf.triggerEvent === event,
    );
    return triggered.map((wf) => ({
      workflow: wf,
      actionResults: wf.actions.map((action) =>
        this.executeAction(action, payload),
      ),
    }));
  }

  /**
   * Simulates execution of an action. Replace with real logic as needed.
   */
  private executeAction(action: string, payload: any): any {
    // Example: log the action and payload
    // In a real system, this could send an email, update a user, etc.
    return { action, payload, status: 'executed', timestamp: new Date() };
  }

  listWorkflows(): AutomationWorkflow[] {
    return this.workflows;
  }

  enableWorkflow(id: string): boolean {
    const wf = this.workflows.find((w) => w.id === id);
    if (wf) {
      wf.enabled = true;
      return true;
    }
    return false;
  }

  disableWorkflow(id: string): boolean {
    const wf = this.workflows.find((w) => w.id === id);
    if (wf) {
      wf.enabled = false;
      return true;
    }
    return false;
  }
}
