import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { config } from '../config';
import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStep,
  WorkflowTrigger,
  ExecutionStatus,
  StepType,
  ExecutionContext,
  ExecutionError,
  WorkflowEvent,
  WorkflowEventType,
  TriggerType,
  ErrorHandlingStrategy
} from '../types/workflow';

export class WorkflowEngine extends EventEmitter {
  private executions: Map<string, WorkflowExecution> = new Map();
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private isRunning: boolean = false;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.on('workflow:started', this.handleWorkflowStarted.bind(this));
    this.on('workflow:completed', this.handleWorkflowCompleted.bind(this));
    this.on('workflow:failed', this.handleWorkflowFailed.bind(this));
    this.on('step:started', this.handleStepStarted.bind(this));
    this.on('step:completed', this.handleStepCompleted.bind(this));
    this.on('step:failed', this.handleStepFailed.bind(this));
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Workflow engine is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Workflow engine started');
    
    // Initialize any background processes
    await this.initializeEngine();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Workflow engine is not running');
      return;
    }

    this.isRunning = false;
    logger.info('Workflow engine stopped');
    
    // Cleanup any background processes
    await this.cleanupEngine();
  }

  private async initializeEngine(): Promise<void> {
    // Load existing workflows
    await this.loadWorkflows();
    
    // Initialize trigger listeners
    await this.initializeTriggers();
    
    // Start cleanup processes
    this.startCleanupProcess();
  }

  private async cleanupEngine(): Promise<void> {
    // Cancel running executions
    for (const [executionId, execution] of this.executions) {
      if (execution.status === ExecutionStatus.RUNNING) {
        await this.cancelExecution(executionId);
      }
    }
  }

  private async loadWorkflows(): Promise<void> {
    // In a real implementation, this would load from database
    logger.info('Loading workflows from database');
    // TODO: Implement database loading
  }

  private async initializeTriggers(): Promise<void> {
    // Initialize all active triggers
    for (const workflow of this.workflows.values()) {
      if (workflow.isActive) {
        for (const trigger of workflow.triggers) {
          if (trigger.isActive) {
            await this.activateTrigger(workflow.id, trigger);
          }
        }
      }
    }
  }

  private startCleanupProcess(): void {
    // Periodically clean up old executions
    setInterval(() => {
      this.cleanupOldExecutions();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private cleanupOldExecutions(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [executionId, execution] of this.executions) {
      if (execution.endTime && execution.endTime < cutoffTime) {
        this.executions.delete(executionId);
      }
    }
  }

  // Workflow Management
  async registerWorkflow(workflow: WorkflowDefinition): Promise<void> {
    this.workflows.set(workflow.id, workflow);
    logger.info(`Workflow registered: ${workflow.name} (${workflow.id})`);
    
    // Activate triggers if workflow is active
    if (workflow.isActive) {
      for (const trigger of workflow.triggers) {
        if (trigger.isActive) {
          await this.activateTrigger(workflow.id, trigger);
        }
      }
    }
  }

  async unregisterWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Deactivate all triggers
    for (const trigger of workflow.triggers) {
      await this.deactivateTrigger(workflowId, trigger.id);
    }

    this.workflows.delete(workflowId);
    logger.info(`Workflow unregistered: ${workflowId}`);
  }

  async activateTrigger(workflowId: string, trigger: WorkflowTrigger): Promise<void> {
    logger.info(`Activating trigger: ${trigger.name} for workflow: ${workflowId}`);
    
    switch (trigger.type) {
      case TriggerType.EVENT:
        await this.setupEventTrigger(workflowId, trigger);
        break;
      case TriggerType.WEBHOOK:
        await this.setupWebhookTrigger(workflowId, trigger);
        break;
      case TriggerType.SCHEDULE:
        await this.setupScheduleTrigger(workflowId, trigger);
        break;
      case TriggerType.API_CALL:
        await this.setupApiTrigger(workflowId, trigger);
        break;
      default:
        logger.warn(`Unsupported trigger type: ${trigger.type}`);
    }
  }

  async deactivateTrigger(workflowId: string, triggerId: string): Promise<void> {
    logger.info(`Deactivating trigger: ${triggerId} for workflow: ${workflowId}`);
    // TODO: Implement trigger deactivation
  }

  // Execution Management
  async executeWorkflow(
    workflowId: string, 
    triggerId: string, 
    inputData: any = {},
    context: Partial<ExecutionContext> = {}
  ): Promise<string> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (!workflow.isActive) {
      throw new Error(`Workflow is not active: ${workflowId}`);
    }

    const executionId = this.generateExecutionId();
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      workflowVersion: workflow.version,
      tenantId: workflow.tenantId,
      status: ExecutionStatus.PENDING,
      startTime: new Date(),
      triggerId,
      triggerData: inputData,
      context: {
        userId: context.userId,
        sessionId: context.sessionId,
        requestId: context.requestId,
        source: context.source || 'manual',
        environment: config.environment,
        tenantId: workflow.tenantId,
        inputData,
        variables: { ...workflow.variables },
        stepResults: {},
        externalData: {}
      },
      variables: {},
      completedSteps: [],
      failedSteps: [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.executions.set(executionId, execution);
    logger.info(`Workflow execution started: ${executionId} for workflow: ${workflowId}`);

    // Start execution asynchronously
    setImmediate(() => this.runExecution(executionId));

    return executionId;
  }

  private async runExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      logger.error(`Execution not found: ${executionId}`);
      return;
    }

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) {
      logger.error(`Workflow not found: ${execution.workflowId}`);
      return;
    }

    try {
      execution.status = ExecutionStatus.RUNNING;
      this.emit('workflow:started', { executionId, workflowId: workflow.id });

      // Execute workflow steps
      await this.executeSteps(execution, workflow);

      // Mark as completed
      execution.status = ExecutionStatus.COMPLETED;
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      
      this.emit('workflow:completed', { executionId, workflowId: workflow.id });
      logger.info(`Workflow execution completed: ${executionId}`);

    } catch (error) {
      execution.status = ExecutionStatus.FAILED;
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      execution.error = {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        recoverable: false,
        stackTrace: error instanceof Error ? error.stack : undefined
      };

      this.emit('workflow:failed', { executionId, workflowId: workflow.id, error });
      logger.error(`Workflow execution failed: ${executionId}`, error);
    }
  }

  private async executeSteps(execution: WorkflowExecution, workflow: WorkflowDefinition): Promise<void> {
    const steps = workflow.steps.sort((a, b) => a.position - b.position);
    
    for (const step of steps) {
      if (!step.isActive) {
        continue;
      }

      // Check conditions
      if (step.conditions.length > 0) {
        const conditionsMet = await this.evaluateConditions(step.conditions, execution.context);
        if (!conditionsMet) {
          logger.debug(`Step conditions not met, skipping: ${step.name}`);
          continue;
        }
      }

      await this.executeStep(execution, step);
    }
  }

  private async executeStep(execution: WorkflowExecution, step: WorkflowStep): Promise<void> {
    logger.info(`Executing step: ${step.name} (${step.id})`);
    
    execution.currentStep = step.id;
    this.emit('step:started', { executionId: execution.id, stepId: step.id, stepName: step.name });

    try {
      const result = await this.runStepLogic(execution, step);
      
      // Store step result
      execution.context.stepResults[step.id] = result;
      execution.completedSteps.push(step.id);
      
      this.emit('step:completed', { executionId: execution.id, stepId: step.id, result });
      logger.debug(`Step completed: ${step.name}`, { result });

    } catch (error) {
      execution.failedSteps.push(step.id);
      this.emit('step:failed', { executionId: execution.id, stepId: step.id, error });
      
      // Handle step error based on error handling strategy
      await this.handleStepError(execution, step, error);
    }
  }

  private async runStepLogic(execution: WorkflowExecution, step: WorkflowStep): Promise<any> {
    const timeout = step.timeout || config.workflow.defaultTimeout;
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Step timed out after ${timeout}ms`));
      }, timeout);

      const executeLogic = async () => {
        try {
          const result = await this.executeStepByType(execution, step);
          clearTimeout(timer);
          resolve(result);
        } catch (error) {
          clearTimeout(timer);
          reject(error);
        }
      };

      executeLogic();
    });
  }

  private async executeStepByType(execution: WorkflowExecution, step: WorkflowStep): Promise<any> {
    switch (step.type) {
      case StepType.API_CALL:
        return await this.executeApiCall(execution, step);
      case StepType.SEND_EMAIL:
        return await this.executeSendEmail(execution, step);
      case StepType.CREATE_CONTACT:
        return await this.executeCreateContact(execution, step);
      case StepType.UPDATE_CONTACT:
        return await this.executeUpdateContact(execution, step);
      case StepType.CREATE_DEAL:
        return await this.executeCreateDeal(execution, step);
      case StepType.CONDITION:
        return await this.executeCondition(execution, step);
      case StepType.WAIT:
        return await this.executeWait(execution, step);
      case StepType.LOG:
        return await this.executeLog(execution, step);
      default:
        throw new Error(`Unsupported step type: ${step.type}`);
    }
  }

  // Step Execution Methods (simplified implementations)
  private async executeApiCall(execution: WorkflowExecution, step: WorkflowStep): Promise<any> {
    // TODO: Implement API call logic
    logger.debug(`Executing API call: ${step.config.url}`);
    return { success: true, message: 'API call executed' };
  }

  private async executeSendEmail(execution: WorkflowExecution, step: WorkflowStep): Promise<any> {
    // TODO: Implement email sending logic
    logger.debug(`Sending email to: ${step.config.to}`);
    return { success: true, message: 'Email sent' };
  }

  private async executeCreateContact(execution: WorkflowExecution, step: WorkflowStep): Promise<any> {
    // TODO: Implement contact creation logic
    logger.debug('Creating contact');
    return { success: true, contactId: 'contact-123' };
  }

  private async executeUpdateContact(execution: WorkflowExecution, step: WorkflowStep): Promise<any> {
    // TODO: Implement contact update logic
    logger.debug('Updating contact');
    return { success: true, message: 'Contact updated' };
  }

  private async executeCreateDeal(execution: WorkflowExecution, step: WorkflowStep): Promise<any> {
    // TODO: Implement deal creation logic
    logger.debug('Creating deal');
    return { success: true, dealId: 'deal-123' };
  }

  private async executeCondition(execution: WorkflowExecution, step: WorkflowStep): Promise<any> {
    // TODO: Implement condition evaluation logic
    logger.debug('Evaluating condition');
    return { success: true, result: true };
  }

  private async executeWait(execution: WorkflowExecution, step: WorkflowStep): Promise<any> {
    const duration = step.config.waitDuration || 1000;
    await new Promise(resolve => setTimeout(resolve, duration));
    return { success: true, message: `Waited ${duration}ms` };
  }

  private async executeLog(execution: WorkflowExecution, step: WorkflowStep): Promise<any> {
    const message = step.config.message || 'Log step executed';
    logger.info(`Workflow log: ${message}`);
    return { success: true, message };
  }

  // Utility Methods
  private async evaluateConditions(conditions: any[], context: ExecutionContext): Promise<boolean> {
    // TODO: Implement condition evaluation logic
    return true;
  }

  private async handleStepError(execution: WorkflowExecution, step: WorkflowStep, error: unknown): Promise<void> {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const strategy = step.errorHandling?.strategy || ErrorHandlingStrategy.STOP;
    
    switch (strategy) {
      case ErrorHandlingStrategy.STOP:
        throw errorObj;
      case ErrorHandlingStrategy.CONTINUE:
        logger.warn(`Step failed but continuing: ${step.name}`, errorObj);
        break;
      case ErrorHandlingStrategy.RETRY:
        await this.retryStep(execution, step, errorObj);
        break;
      case ErrorHandlingStrategy.SKIP:
        logger.warn(`Step failed, skipping: ${step.name}`, errorObj);
        break;
      default:
        throw errorObj;
    }
  }

  private async retryStep(execution: WorkflowExecution, step: WorkflowStep, error: Error): Promise<void> {
    const maxRetries = step.retryAttempts || config.workflow.maxRetries;
    const retryDelay = step.retryDelay || config.workflow.retryDelay;
    
    // TODO: Implement retry logic
    logger.warn(`Retrying step: ${step.name}`, { maxRetries, retryDelay });
  }

  private async setupEventTrigger(workflowId: string, trigger: WorkflowTrigger): Promise<void> {
    // TODO: Setup event-based trigger
    logger.debug(`Setting up event trigger: ${trigger.name}`);
  }

  private async setupWebhookTrigger(workflowId: string, trigger: WorkflowTrigger): Promise<void> {
    // TODO: Setup webhook trigger
    logger.debug(`Setting up webhook trigger: ${trigger.name}`);
  }

  private async setupScheduleTrigger(workflowId: string, trigger: WorkflowTrigger): Promise<void> {
    // TODO: Setup scheduled trigger
    logger.debug(`Setting up schedule trigger: ${trigger.name}`);
  }

  private async setupApiTrigger(workflowId: string, trigger: WorkflowTrigger): Promise<void> {
    // TODO: Setup API trigger
    logger.debug(`Setting up API trigger: ${trigger.name}`);
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    execution.status = ExecutionStatus.CANCELLED;
    execution.endTime = new Date();
    execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
    
    logger.info(`Workflow execution cancelled: ${executionId}`);
  }

  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  getExecutions(workflowId?: string): WorkflowExecution[] {
    const executions = Array.from(this.executions.values());
    return workflowId ? executions.filter(e => e.workflowId === workflowId) : executions;
  }

  // Event Handlers
  private handleWorkflowStarted(event: any): void {
    logger.info('Workflow started', event);
  }

  private handleWorkflowCompleted(event: any): void {
    logger.info('Workflow completed', event);
  }

  private handleWorkflowFailed(event: any): void {
    logger.error('Workflow failed', event);
  }

  private handleStepStarted(event: any): void {
    logger.debug('Step started', event);
  }

  private handleStepCompleted(event: any): void {
    logger.debug('Step completed', event);
  }

  private handleStepFailed(event: any): void {
    logger.error('Step failed', event);
  }
}