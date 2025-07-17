/**
 * Sample CRM Extension Plugin
 * 
 * This plugin demonstrates how to:
 * - Register hooks for CRM events
 * - Provide custom API endpoints
 * - Store and retrieve plugin settings
 * - Send notifications
 * - Integrate with external services
 */

// Plugin initialization
const plugin = {
  name: 'Sample CRM Extension',
  version: '1.0.0',
  
  // Plugin initialization
  async init() {
    console.log('Sample CRM Extension initialized');
    
    // Register event hooks
    this.registerHooks();
    
    // Initialize external service connection
    await this.initializeExternalService();
    
    console.log('Sample CRM Extension ready');
  },
  
  // Register hooks for CRM events
  registerHooks() {
    // Hook: After contact creation
    registerHook('after:create:contact', async (context) => {
      const { contact, user, tenant } = context;
      
      console.log(`New contact created: ${contact.name}`);
      
      // Get plugin settings
      const settings = await this.getSettings();
      
      if (settings.enableNotifications) {
        await this.sendNotification({
          type: 'contact_created',
          message: `New contact ${contact.name} has been created`,
          user: user.id,
          tenant: tenant.id
        });
      }
      
      // Sync with external service if enabled
      if (settings.syncInterval === 'realtime') {
        await this.syncContactToExternalService(contact);
      }
      
      return { processed: true, contactId: contact.id };
    });
    
    // Hook: After opportunity update
    registerHook('after:update:opportunity', async (context) => {
      const { opportunity, changes, user, tenant } = context;
      
      console.log(`Opportunity updated: ${opportunity.name}`);
      
      // Check if status changed to "won"
      if (changes.status === 'won') {
        await this.handleWonOpportunity(opportunity, user, tenant);
      }
      
      return { processed: true, opportunityId: opportunity.id };
    });
    
    // Hook: Dashboard render
    registerHook('dashboard:render', async (context) => {
      const { user, tenant } = context;
      
      // Add custom dashboard widget
      const analyticsData = await this.getAnalytics(user, tenant);
      
      return {
        widget: {
          id: 'sample-analytics',
          title: 'Sample Analytics',
          type: 'chart',
          data: analyticsData,
          template: 'dashboard-widget.html'
        }
      };
    });
  },
  
  // API endpoint handlers
  async getAnalytics(user, tenant) {
    try {
      const settings = await this.getSettings();
      
      // Simulate analytics data
      const data = {
        totalContacts: await this.getContactCount(tenant.id),
        totalOpportunities: await this.getOpportunityCount(tenant.id),
        conversionRate: await this.getConversionRate(tenant.id),
        lastSync: await this.getLastSyncTime()
      };
      
      return {
        success: true,
        data: data,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get analytics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  async syncData(user, tenant, payload) {
    try {
      const settings = await this.getSettings();
      
      if (!settings.apiKey) {
        throw new Error('API key not configured');
      }
      
      const { type, data } = payload;
      
      if (type === 'contacts') {
        await this.syncContactsToExternalService(data, settings);
      } else if (type === 'opportunities') {
        await this.syncOpportunitiesToExternalService(data, settings);
      }
      
      return {
        success: true,
        message: `${type} synchronized successfully`,
        count: data.length
      };
    } catch (error) {
      console.error('Failed to sync data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  // Helper methods
  async getSettings() {
    return await storage.get('settings') || {};
  },
  
  async saveSettings(settings) {
    await storage.set('settings', settings);
  },
  
  async initializeExternalService() {
    const settings = await this.getSettings();
    
    if (settings.apiKey) {
      // Initialize external service connection
      console.log('Connecting to external service...');
      
      // Simulate connection test
      try {
        await this.testExternalConnection(settings.apiKey);
        console.log('External service connected successfully');
      } catch (error) {
        console.error('Failed to connect to external service:', error);
      }
    }
  },
  
  async testExternalConnection(apiKey) {
    // Simulate external API call
    const response = await http.get('https://api.example.com/test', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  },
  
  async syncContactToExternalService(contact) {
    const settings = await this.getSettings();
    
    if (!settings.apiKey) {
      console.log('No API key configured, skipping sync');
      return;
    }
    
    try {
      const syncData = {};
      
      // Only sync selected fields
      settings.syncFields.forEach(field => {
        if (contact[field]) {
          syncData[field] = contact[field];
        }
      });
      
      await http.post('https://api.example.com/contacts', syncData, {
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Contact ${contact.name} synced to external service`);
    } catch (error) {
      console.error('Failed to sync contact:', error);
    }
  },
  
  async syncContactsToExternalService(contacts, settings) {
    for (const contact of contacts) {
      await this.syncContactToExternalService(contact);
    }
  },
  
  async syncOpportunitiesToExternalService(opportunities, settings) {
    // Similar to contacts sync
    console.log(`Syncing ${opportunities.length} opportunities`);
  },
  
  async handleWonOpportunity(opportunity, user, tenant) {
    console.log(`Opportunity won: ${opportunity.name}, value: ${opportunity.value}`);
    
    // Send congratulations notification
    await this.sendNotification({
      type: 'opportunity_won',
      message: `Congratulations! Opportunity "${opportunity.name}" has been won!`,
      user: user.id,
      tenant: tenant.id
    });
    
    // Update external CRM
    await this.updateExternalOpportunity(opportunity, 'won');
  },
  
  async updateExternalOpportunity(opportunity, status) {
    const settings = await this.getSettings();
    
    if (settings.apiKey) {
      try {
        await http.put(`https://api.example.com/opportunities/${opportunity.id}`, {
          status: status,
          value: opportunity.value,
          updatedAt: new Date().toISOString()
        }, {
          headers: {
            'Authorization': `Bearer ${settings.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.error('Failed to update external opportunity:', error);
      }
    }
  },
  
  async sendNotification(notification) {
    // Use the platform's notification system
    events.emit('notification:send', notification);
  },
  
  async getContactCount(tenantId) {
    // This would normally query the database
    return Math.floor(Math.random() * 1000) + 100;
  },
  
  async getOpportunityCount(tenantId) {
    // This would normally query the database
    return Math.floor(Math.random() * 100) + 10;
  },
  
  async getConversionRate(tenantId) {
    // This would normally calculate from database
    return Math.floor(Math.random() * 30) + 10;
  },
  
  async getLastSyncTime() {
    const lastSync = await storage.get('lastSync');
    return lastSync || new Date().toISOString();
  },
  
  async setLastSyncTime() {
    await storage.set('lastSync', new Date().toISOString());
  }
};

// Initialize plugin
plugin.init().catch(error => {
  console.error('Plugin initialization failed:', error);
});

// Export plugin for the system
if (typeof module !== 'undefined' && module.exports) {
  module.exports = plugin;
}