// Модель для аналитических событий
export interface AnalyticsEvent {
  id?: string;
  tenant_id: string;
  user_id?: string;
  event_name: string;
  properties?: Record<string, any>;
  timestamp?: Date;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
}

// Типы событий CRM
export enum CRMEventType {
  // Authentication Events
  USER_LOGIN = 'User Login',
  USER_LOGOUT = 'User Logout',
  USER_REGISTERED = 'User Registered',
  
  // Navigation Events
  PAGE_VIEWED = 'Page Viewed',
  FEATURE_USED = 'Feature Used',
  
  // Lead Management Events
  LEAD_GENERATED = 'Lead Generated',
  LEAD_QUALIFIED = 'Lead Qualified',
  LEAD_CONVERTED = 'Lead Converted',
  
  // Company Events
  COMPANY_CREATED = 'Company Created',
  COMPANY_UPDATED = 'Company Updated',
  COMPANY_VIEWED = 'Company Viewed',
  COMPANY_DELETED = 'Company Deleted',
  
  // Contact Events
  CONTACT_CREATED = 'Contact Created',
  CONTACT_UPDATED = 'Contact Updated',
  CONTACT_VIEWED = 'Contact Viewed',
  CONTACT_DELETED = 'Contact Deleted',
  
  // Opportunity Events
  OPPORTUNITY_CREATED = 'Opportunity Created',
  OPPORTUNITY_UPDATED = 'Opportunity Updated',
  OPPORTUNITY_STAGE_CHANGED = 'Opportunity Stage Changed',
  OPPORTUNITY_WON = 'Opportunity Won',
  OPPORTUNITY_LOST = 'Opportunity Lost',
  OPPORTUNITY_VIEWED = 'Opportunity Viewed',
  OPPORTUNITY_DELETED = 'Opportunity Deleted',
  
  // Communication Events
  EMAIL_SENT = 'Email Sent',
  SMS_SENT = 'SMS Sent',
  CALL_MADE = 'Call Made',
  MEETING_SCHEDULED = 'Meeting Scheduled',
  
  // Sales Process Events
  PROPOSAL_SENT = 'Proposal Sent',
  CONTRACT_SIGNED = 'Contract Signed',
  PAYMENT_RECEIVED = 'Payment Received',
  
  // System Events
  EXPORT_DATA = 'Export Data',
  IMPORT_DATA = 'Import Data',
  REPORT_GENERATED = 'Report Generated',
  DASHBOARD_VIEWED = 'Dashboard Viewed',
  
  // Error Events
  API_ERROR = 'API Error',
  VALIDATION_ERROR = 'Validation Error',
  SYSTEM_ERROR = 'System Error',
}

// Стандартные свойства для различных типов событий
export interface PageViewProperties {
  page: string;
  url?: string;
  referrer?: string;
  load_time?: number;
  viewport_width?: number;
  viewport_height?: number;
}

export interface FeatureUsedProperties {
  feature: string;
  action?: string;
  time_spent?: number;
  success?: boolean;
}

export interface OpportunityProperties {
  opportunity_id: string;
  opportunity_name?: string;
  amount?: number;
  stage?: string;
  previous_stage?: string;
  probability?: number;
  close_date?: string;
  company_id?: string;
  contact_id?: string;
}

export interface CompanyProperties {
  company_id: string;
  company_name?: string;
  company_type?: string;
  industry?: string;
  size?: string;
  annual_revenue?: number;
}

export interface ContactProperties {
  contact_id: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  company_id?: string;
  title?: string;
}

export interface CommunicationProperties {
  communication_type: 'email' | 'sms' | 'call' | 'meeting';
  recipient?: string;
  subject?: string;
  duration?: number;
  success?: boolean;
  error_message?: string;
}

// Утилиты для создания событий
export class EventBuilder {
  private event: Partial<AnalyticsEvent> = {};

  static create(): EventBuilder {
    return new EventBuilder();
  }

  tenantId(tenantId: string): EventBuilder {
    this.event.tenant_id = tenantId;
    return this;
  }

  userId(userId: string): EventBuilder {
    this.event.user_id = userId;
    return this;
  }

  eventName(eventName: CRMEventType | string): EventBuilder {
    this.event.event_name = eventName;
    return this;
  }

  properties(properties: Record<string, any>): EventBuilder {
    this.event.properties = { ...this.event.properties, ...properties };
    return this;
  }

  sessionId(sessionId: string): EventBuilder {
    this.event.session_id = sessionId;
    return this;
  }

  ipAddress(ipAddress: string): EventBuilder {
    this.event.ip_address = ipAddress;
    return this;
  }

  userAgent(userAgent: string): EventBuilder {
    this.event.user_agent = userAgent;
    return this;
  }

  build(): AnalyticsEvent {
    if (!this.event.tenant_id || !this.event.event_name) {
      throw new Error('tenant_id and event_name are required');
    }

    return {
      ...this.event,
      timestamp: new Date(),
    } as AnalyticsEvent;
  }
}