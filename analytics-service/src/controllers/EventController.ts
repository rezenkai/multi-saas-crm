import { Router, Request, Response } from 'express';
import { EventService } from '../services/EventService';
import { AnalyticsEvent, CRMEventType, EventBuilder } from '../models/Event';

export function eventRoutes(eventService: EventService): Router {
  const router = Router();

  /**
   * POST /api/events/track
   * Track a single analytics event
   */
  router.post('/track', async (req: Request, res: Response) => {
    try {
      const { tenant_id, user_id, event_name, properties, session_id } = req.body;

      // Validation
      if (!tenant_id || !event_name) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'tenant_id and event_name are required'
        });
      }

      // Extract additional info from request
      const event: AnalyticsEvent = {
        tenant_id,
        user_id,
        event_name,
        properties: properties || {},
        session_id,
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('User-Agent'),
        timestamp: new Date()
      };

      await eventService.trackEvent(event);

      res.status(200).json({
        success: true,
        message: 'Event tracked successfully',
        event_id: event.id
      });

    } catch (error: any) {
      console.error('❌ Error tracking event:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * POST /api/events/batch
   * Track multiple events in batch
   */
  router.post('/batch', async (req: Request, res: Response) => {
    try {
      const { events } = req.body;

      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'events array is required and cannot be empty'
        });
      }

      if (events.length > 1000) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Maximum 1000 events per batch'
        });
      }

      // Add request context to events
      const eventsWithContext = events.map(event => ({
        ...event,
        ip_address: event.ip_address || req.ip || req.connection.remoteAddress,
        user_agent: event.user_agent || req.get('User-Agent'),
        timestamp: event.timestamp || new Date()
      }));

      await eventService.trackBatch(eventsWithContext);

      res.status(200).json({
        success: true,
        message: `${events.length} events tracked successfully`,
        count: events.length
      });

    } catch (error: any) {
      console.error('❌ Error tracking batch:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * GET /api/events/user/:userId
   * Get recent events for a specific user
   */
  router.get('/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const tenantId = req.get('X-Tenant-ID');
      const limit = parseInt(req.query.limit as string) || 50;

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'X-Tenant-ID header is required'
        });
      }

      if (limit > 1000) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Maximum limit is 1000'
        });
      }

      const events = await eventService.getUserEvents(tenantId, userId, limit);

      res.json({
        success: true,
        data: events,
        count: events.length,
        user_id: userId,
        tenant_id: tenantId
      });

    } catch (error: any) {
      console.error('❌ Error getting user events:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * GET /api/events/session/:sessionId
   * Get events for a specific session
   */
  router.get('/session/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const tenantId = req.get('X-Tenant-ID');

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'X-Tenant-ID header is required'
        });
      }

      const events = await eventService.getSessionEvents(sessionId, tenantId);

      res.json({
        success: true,
        data: events,
        count: events.length,
        session_id: sessionId,
        tenant_id: tenantId
      });

    } catch (error: any) {
      console.error('❌ Error getting session events:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * GET /api/events/top
   * Get most popular events
   */
  router.get('/top', async (req: Request, res: Response) => {
    try {
      const tenantId = req.get('X-Tenant-ID');
      const days = parseInt(req.query.days as string) || 7;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'X-Tenant-ID header is required'
        });
      }

      if (days > 365) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Maximum days is 365'
        });
      }

      const topEvents = await eventService.getTopEvents(tenantId, days, limit);

      res.json({
        success: true,
        data: topEvents,
        count: topEvents.length,
        period: `${days} days`,
        tenant_id: tenantId
      });

    } catch (error: any) {
      console.error('❌ Error getting top events:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * POST /api/events/crm/opportunity-won
   * Convenience endpoint for tracking opportunity won events
   */
  router.post('/crm/opportunity-won', async (req: Request, res: Response) => {
    try {
      const { tenant_id, user_id, opportunity_id, opportunity_name, amount, close_date, company_id, session_id } = req.body;

      if (!tenant_id || !user_id || !opportunity_id) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'tenant_id, user_id, and opportunity_id are required'
        });
      }

      const event = eventService.createCRMEvent(
        tenant_id,
        user_id,
        CRMEventType.OPPORTUNITY_WON,
        {
          opportunity_id,
          opportunity_name,
          amount: parseFloat(amount) || 0,
          stage: 'CLOSED_WON',
          close_date,
          company_id
        }
      );

      if (session_id) {
        event.session_id = session_id;
      }

      event.ip_address = req.ip || req.connection.remoteAddress;
      event.user_agent = req.get('User-Agent');

      await eventService.trackEvent(event);

      res.status(200).json({
        success: true,
        message: 'Opportunity won event tracked',
        event_id: event.id,
        amount: parseFloat(amount) || 0
      });

    } catch (error: any) {
      console.error('❌ Error tracking opportunity won:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * POST /api/events/crm/page-view
   * Convenience endpoint for tracking page views
   */
  router.post('/crm/page-view', async (req: Request, res: Response) => {
    try {
      const { tenant_id, user_id, page, url, referrer, load_time, session_id } = req.body;

      if (!tenant_id || !page) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'tenant_id and page are required'
        });
      }

      const event = eventService.createCRMEvent(
        tenant_id,
        user_id,
        CRMEventType.PAGE_VIEWED,
        {
          page,
          url,
          referrer,
          load_time: parseFloat(load_time) || 0,
          viewport_width: parseInt(req.body.viewport_width) || 0,
          viewport_height: parseInt(req.body.viewport_height) || 0
        }
      );

      if (session_id) {
        event.session_id = session_id;
      }

      event.ip_address = req.ip || req.connection.remoteAddress;
      event.user_agent = req.get('User-Agent');

      await eventService.trackEvent(event);

      res.status(200).json({
        success: true,
        message: 'Page view event tracked',
        event_id: event.id,
        page
      });

    } catch (error: any) {
      console.error('❌ Error tracking page view:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  /**
   * GET /api/events/types
   * Get available CRM event types
   */
  router.get('/types', (req: Request, res: Response) => {
    const eventTypes = Object.values(CRMEventType).map(type => ({
      key: type.toUpperCase().replace(/\s+/g, '_'),
      name: type,
      description: getEventTypeDescription(type)
    }));

    res.json({
      success: true,
      data: eventTypes,
      count: eventTypes.length
    });
  });

  return router;
}

function getEventTypeDescription(eventType: CRMEventType): string {
  const descriptions: Record<CRMEventType, string> = {
    [CRMEventType.USER_LOGIN]: 'User authentication successful',
    [CRMEventType.USER_LOGOUT]: 'User logged out',
    [CRMEventType.USER_REGISTERED]: 'New user registration',
    [CRMEventType.PAGE_VIEWED]: 'User viewed a page',
    [CRMEventType.FEATURE_USED]: 'User interacted with a feature',
    [CRMEventType.LEAD_GENERATED]: 'New lead was generated',
    [CRMEventType.LEAD_QUALIFIED]: 'Lead was qualified',
    [CRMEventType.LEAD_CONVERTED]: 'Lead was converted to opportunity',
    [CRMEventType.COMPANY_CREATED]: 'New company was created',
    [CRMEventType.COMPANY_UPDATED]: 'Company information was updated',
    [CRMEventType.COMPANY_VIEWED]: 'Company profile was viewed',
    [CRMEventType.COMPANY_DELETED]: 'Company was deleted',
    [CRMEventType.CONTACT_CREATED]: 'New contact was created',
    [CRMEventType.CONTACT_UPDATED]: 'Contact information was updated',
    [CRMEventType.CONTACT_VIEWED]: 'Contact profile was viewed',
    [CRMEventType.CONTACT_DELETED]: 'Contact was deleted',
    [CRMEventType.OPPORTUNITY_CREATED]: 'New opportunity was created',
    [CRMEventType.OPPORTUNITY_UPDATED]: 'Opportunity was updated',
    [CRMEventType.OPPORTUNITY_STAGE_CHANGED]: 'Opportunity stage was changed',
    [CRMEventType.OPPORTUNITY_WON]: 'Opportunity was won',
    [CRMEventType.OPPORTUNITY_LOST]: 'Opportunity was lost',
    [CRMEventType.OPPORTUNITY_VIEWED]: 'Opportunity was viewed',
    [CRMEventType.OPPORTUNITY_DELETED]: 'Opportunity was deleted',
    [CRMEventType.EMAIL_SENT]: 'Email was sent',
    [CRMEventType.SMS_SENT]: 'SMS was sent',
    [CRMEventType.CALL_MADE]: 'Phone call was made',
    [CRMEventType.MEETING_SCHEDULED]: 'Meeting was scheduled',
    [CRMEventType.PROPOSAL_SENT]: 'Proposal was sent',
    [CRMEventType.CONTRACT_SIGNED]: 'Contract was signed',
    [CRMEventType.PAYMENT_RECEIVED]: 'Payment was received',
    [CRMEventType.EXPORT_DATA]: 'Data was exported',
    [CRMEventType.IMPORT_DATA]: 'Data was imported',
    [CRMEventType.REPORT_GENERATED]: 'Report was generated',
    [CRMEventType.DASHBOARD_VIEWED]: 'Dashboard was viewed',
    [CRMEventType.API_ERROR]: 'API error occurred',
    [CRMEventType.VALIDATION_ERROR]: 'Validation error occurred',
    [CRMEventType.SYSTEM_ERROR]: 'System error occurred'
  };

  return descriptions[eventType] || 'Analytics event';
}