// Workflow Types and Interfaces

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  isActive: boolean;
  tenantId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Workflow Structure
  triggers: WorkflowTrigger[];
  steps: WorkflowStep[];
  variables: WorkflowVariable[];
  
  // Configuration
  settings: WorkflowSettings;
  metadata: Record<string, any>;
}

export interface WorkflowTrigger {
  id: string;
  type: TriggerType;
  name: string;
  description?: string;
  isActive: boolean;
  
  // Trigger Configuration
  config: TriggerConfig;
  conditions: WorkflowCondition[];
  
  // Scheduling (for scheduled triggers)
  schedule?: {
    cron?: string;
    timezone?: string;
    startDate?: Date;
    endDate?: Date;
  };
}

export enum TriggerType {
  MANUAL = 'manual',
  EVENT = 'event',
  WEBHOOK = 'webhook',
  SCHEDULE = 'schedule',
  API_CALL = 'api_call',
  EMAIL = 'email',
  FORM_SUBMISSION = 'form_submission',
  DATA_CHANGE = 'data_change',
}

export interface TriggerConfig {
  // Event-based triggers
  eventSource?: string; // e.g., 'crm', 'erp', 'marketing'
  eventType?: string; // e.g., 'deal_created', 'contact_updated'
  
  // Webhook triggers
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  webhookSecret?: string;
  
  // API triggers
  apiPath?: string;
  apiMethod?: string;
  
  // Form triggers
  formId?: string;
  
  // Data change triggers
  entityType?: string;
  entityId?: string;
  watchFields?: string[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  description?: string;
  isActive: boolean;
  position: number;
  
  // Step Configuration
  config: StepConfig;
  
  // Flow Control
  conditions: WorkflowCondition[];
  nextSteps: string[]; // IDs of next steps
  errorHandling?: ErrorHandling;
  
  // Execution
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export enum StepType {
  // Data Operations
  GET_DATA = 'get_data',
  SET_DATA = 'set_data',
  TRANSFORM_DATA = 'transform_data',
  VALIDATE_DATA = 'validate_data',
  
  // API Operations
  API_CALL = 'api_call',
  WEBHOOK_CALL = 'webhook_call',
  
  // Communication
  SEND_EMAIL = 'send_email',
  SEND_SMS = 'send_sms',
  SEND_NOTIFICATION = 'send_notification',
  
  // CRM Operations
  CREATE_CONTACT = 'create_contact',
  UPDATE_CONTACT = 'update_contact',
  CREATE_DEAL = 'create_deal',
  UPDATE_DEAL = 'update_deal',
  CREATE_TASK = 'create_task',
  
  // Logic Operations
  CONDITION = 'condition',
  LOOP = 'loop',
  WAIT = 'wait',
  
  // Integration
  EXTERNAL_SERVICE = 'external_service',
  DATABASE_QUERY = 'database_query',
  
  // Utility
  LOG = 'log',
  STOP = 'stop',
}

export interface StepConfig {
  // API Call Configuration
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  
  // Email Configuration
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  attachments?: EmailAttachment[];
  
  // SMS Configuration
  phoneNumber?: string;
  message?: string;
  
  // Data Operations
  sourceField?: string;
  targetField?: string;
  transformation?: string; // JavaScript code or template
  
  // Condition Configuration
  expression?: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value?: any;
  
  // Loop Configuration
  iterableField?: string;
  itemVariable?: string;
  maxIterations?: number;
  
  // Wait Configuration
  waitType?: 'fixed' | 'until_condition' | 'until_webhook';
  waitDuration?: number; // milliseconds
  waitCondition?: WorkflowCondition;
  
  // Service Integration
  serviceType?: string;
  serviceConfig?: Record<string, any>;
  
  // Database Query
  query?: string;
  parameters?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType: string;
}

export interface WorkflowCondition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: any;
  type: ConditionType;
  logicalOperator?: LogicalOperator;
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  IN = 'in',
  NOT_IN = 'not_in',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null',
  REGEX = 'regex',
}

export enum ConditionType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  ARRAY = 'array',
  OBJECT = 'object',
}

export enum LogicalOperator {
  AND = 'and',
  OR = 'or',
  NOT = 'not',
}

export interface WorkflowVariable {
  id: string;
  name: string;
  type: VariableType;
  value: any;
  description?: string;
  isSecret: boolean;
  scope: VariableScope;
}

export enum VariableType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  ARRAY = 'array',
  OBJECT = 'object',
  JSON = 'json',
}

export enum VariableScope {
  GLOBAL = 'global',
  WORKFLOW = 'workflow',
  STEP = 'step',
  EXECUTION = 'execution',
}

export interface WorkflowSettings {
  maxExecutionTime?: number;
  maxConcurrentExecutions?: number;
  enableLogging?: boolean;
  enableMetrics?: boolean;
  enableNotifications?: boolean;
  errorHandlingStrategy?: ErrorHandlingStrategy;
  retryPolicy?: RetryPolicy;
}

export enum ErrorHandlingStrategy {
  STOP = 'stop',
  CONTINUE = 'continue',
  RETRY = 'retry',
  SKIP = 'skip',
  CUSTOM = 'custom',
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelay: number;
  backoffMultiplier: number;
  maxDelay: number;
}

export interface ErrorHandling {
  strategy: ErrorHandlingStrategy;
  retryPolicy?: RetryPolicy;
  fallbackSteps?: string[];
  notificationConfig?: NotificationConfig;
}

export interface NotificationConfig {
  enabled: boolean;
  channels: NotificationChannel[];
  recipients: string[];
  template?: string;
}

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
}

// Workflow Execution Types
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: string;
  tenantId: string;
  
  // Execution Status
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  
  // Trigger Information
  triggerId: string;
  triggerData: any;
  
  // Execution Context
  context: ExecutionContext;
  variables: Record<string, any>;
  
  // Progress Tracking
  currentStep?: string;
  completedSteps: string[];
  failedSteps: string[];
  
  // Error Information
  error?: ExecutionError;
  
  // Metadata
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused',
  SCHEDULED = 'scheduled',
}

export interface ExecutionContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  source: string;
  environment: string;
  tenantId: string;
  
  // Input Data
  inputData: any;
  
  // Runtime Variables
  variables: Record<string, any>;
  
  // Step Results
  stepResults: Record<string, any>;
  
  // External Data
  externalData: Record<string, any>;
}

export interface ExecutionError {
  code: string;
  message: string;
  stepId?: string;
  stepName?: string;
  stackTrace?: string;
  timestamp: Date;
  recoverable: boolean;
}

// Workflow Builder Types
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  
  // Template Definition
  definition: Partial<WorkflowDefinition>;
  
  // Usage Statistics
  usageCount: number;
  rating: number;
  
  // Customization Options
  customizableFields: string[];
  requiredFields: string[];
}

export interface WorkflowBuilderState {
  workflowId: string;
  definition: WorkflowDefinition;
  selectedStep?: string;
  selectedTrigger?: string;
  isValid: boolean;
  validationErrors: ValidationError[];
  isDirty: boolean;
}

export interface ValidationError {
  type: 'error' | 'warning';
  field: string;
  message: string;
  stepId?: string;
  triggerId?: string;
}

// Integration Types
export interface IntegrationConnector {
  id: string;
  name: string;
  type: string;
  version: string;
  description: string;
  
  // Configuration
  config: ConnectorConfig;
  
  // Capabilities
  supportedOperations: string[];
  supportedTriggers: string[];
  
  // Authentication
  authType: AuthType;
  authConfig: AuthConfig;
  
  // Status
  isActive: boolean;
  lastTested: Date;
  status: ConnectorStatus;
}

export interface ConnectorConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  rateLimit?: RateLimit;
  customHeaders?: Record<string, string>;
}

export interface RateLimit {
  requestsPerSecond: number;
  burstLimit: number;
  windowSize: number;
}

export enum AuthType {
  NONE = 'none',
  API_KEY = 'api_key',
  OAUTH2 = 'oauth2',
  BASIC = 'basic',
  BEARER = 'bearer',
  CUSTOM = 'custom',
}

export interface AuthConfig {
  type: AuthType;
  apiKey?: string;
  username?: string;
  password?: string;
  token?: string;
  oauth2Config?: OAuth2Config;
  customAuth?: Record<string, any>;
}

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri: string;
}

export enum ConnectorStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  TESTING = 'testing',
}

// Event Types
export interface WorkflowEvent {
  id: string;
  type: WorkflowEventType;
  workflowId: string;
  executionId?: string;
  tenantId: string;
  
  // Event Data
  data: any;
  
  // Timestamp
  timestamp: Date;
  
  // Metadata
  source: string;
  userId?: string;
  metadata: Record<string, any>;
}

export enum WorkflowEventType {
  WORKFLOW_CREATED = 'workflow_created',
  WORKFLOW_UPDATED = 'workflow_updated',
  WORKFLOW_DELETED = 'workflow_deleted',
  WORKFLOW_ACTIVATED = 'workflow_activated',
  WORKFLOW_DEACTIVATED = 'workflow_deactivated',
  
  EXECUTION_STARTED = 'execution_started',
  EXECUTION_COMPLETED = 'execution_completed',
  EXECUTION_FAILED = 'execution_failed',
  EXECUTION_CANCELLED = 'execution_cancelled',
  
  STEP_STARTED = 'step_started',
  STEP_COMPLETED = 'step_completed',
  STEP_FAILED = 'step_failed',
  STEP_SKIPPED = 'step_skipped',
  
  TRIGGER_ACTIVATED = 'trigger_activated',
  TRIGGER_DEACTIVATED = 'trigger_deactivated',
  
  ERROR_OCCURRED = 'error_occurred',
  WARNING_OCCURRED = 'warning_occurred',
}