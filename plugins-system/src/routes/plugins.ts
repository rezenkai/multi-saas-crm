import { Router, Request, Response } from 'express';
import { PluginManager } from '../core/PluginManager';
import { PluginStatus } from '../types/plugin';
import { logger } from '../utils/logger';

const router = Router();

// Get all plugins
router.get('/', async (req: Request, res: Response) => {
  try {
    const pluginManager = req.app.locals.pluginManager as PluginManager;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    const plugins = pluginManager.getPlugins();
    const tenantPlugins = tenantId ? plugins.filter(p => p.tenantId === tenantId) : plugins;
    
    res.json({
      plugins: tenantPlugins,
      total: tenantPlugins.length,
      active: tenantPlugins.filter(p => p.status === PluginStatus.ACTIVE).length,
      inactive: tenantPlugins.filter(p => p.status === PluginStatus.INACTIVE).length,
    });
  } catch (error) {
    logger.error('Failed to get plugins:', error);
    res.status(500).json({ error: 'Failed to get plugins' });
  }
});

// Get plugin by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const pluginManager = req.app.locals.pluginManager as PluginManager;
    const plugin = pluginManager.getPlugin(req.params.id);
    
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    
    const tenantId = req.headers['x-tenant-id'] as string;
    if (tenantId && plugin.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(plugin);
  } catch (error) {
    logger.error('Failed to get plugin:', error);
    res.status(500).json({ error: 'Failed to get plugin' });
  }
});

// Activate plugin
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const pluginManager = req.app.locals.pluginManager as PluginManager;
    const plugin = pluginManager.getPlugin(req.params.id);
    
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    
    const tenantId = req.headers['x-tenant-id'] as string;
    if (tenantId && plugin.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await pluginManager.activatePlugin(req.params.id);
    
    res.json({ message: 'Plugin activated successfully' });
  } catch (error) {
    logger.error('Failed to activate plugin:', error);
    res.status(500).json({ 
      error: 'Failed to activate plugin',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Deactivate plugin
router.post('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    const pluginManager = req.app.locals.pluginManager as PluginManager;
    const plugin = pluginManager.getPlugin(req.params.id);
    
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    
    const tenantId = req.headers['x-tenant-id'] as string;
    if (tenantId && plugin.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await pluginManager.deactivatePlugin(req.params.id);
    
    res.json({ message: 'Plugin deactivated successfully' });
  } catch (error) {
    logger.error('Failed to deactivate plugin:', error);
    res.status(500).json({ 
      error: 'Failed to deactivate plugin',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Uninstall plugin
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const pluginManager = req.app.locals.pluginManager as PluginManager;
    const plugin = pluginManager.getPlugin(req.params.id);
    
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    
    const tenantId = req.headers['x-tenant-id'] as string;
    if (tenantId && plugin.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await pluginManager.uninstallPlugin(req.params.id);
    
    res.json({ message: 'Plugin uninstalled successfully' });
  } catch (error) {
    logger.error('Failed to uninstall plugin:', error);
    res.status(500).json({ 
      error: 'Failed to uninstall plugin',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update plugin settings
router.put('/:id/settings', async (req: Request, res: Response) => {
  try {
    const pluginManager = req.app.locals.pluginManager as PluginManager;
    const plugin = pluginManager.getPlugin(req.params.id);
    
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    
    const tenantId = req.headers['x-tenant-id'] as string;
    if (tenantId && plugin.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const settings = req.body.settings || {};
    
    // Validate settings against plugin manifest
    if (plugin.manifest.settings) {
      for (const settingDef of plugin.manifest.settings) {
        const value = settings[settingDef.key];
        
        if (settingDef.required && value === undefined) {
          return res.status(400).json({ 
            error: `Required setting '${settingDef.key}' is missing`
          });
        }
        
        if (value !== undefined) {
          // Type validation
          if (settingDef.type === 'number' && typeof value !== 'number') {
            return res.status(400).json({ 
              error: `Setting '${settingDef.key}' must be a number`
            });
          }
          
          if (settingDef.type === 'boolean' && typeof value !== 'boolean') {
            return res.status(400).json({ 
              error: `Setting '${settingDef.key}' must be a boolean`
            });
          }
          
          if (['select', 'multiselect'].includes(settingDef.type) && settingDef.options) {
            const validValues = settingDef.options.map(opt => opt.value);
            if (settingDef.type === 'select' && !validValues.includes(value)) {
              return res.status(400).json({ 
                error: `Setting '${settingDef.key}' must be one of: ${validValues.join(', ')}`
              });
            }
            
            if (settingDef.type === 'multiselect' && Array.isArray(value)) {
              const invalidValues = value.filter(v => !validValues.includes(v));
              if (invalidValues.length > 0) {
                return res.status(400).json({ 
                  error: `Setting '${settingDef.key}' contains invalid values: ${invalidValues.join(', ')}`
                });
              }
            }
          }
        }
      }
    }
    
    // Update plugin settings
    plugin.settings = { ...plugin.settings, ...settings };
    
    // TODO: Update in registry
    
    res.json({ 
      message: 'Plugin settings updated successfully',
      settings: plugin.settings
    });
  } catch (error) {
    logger.error('Failed to update plugin settings:', error);
    res.status(500).json({ 
      error: 'Failed to update plugin settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get plugin settings
router.get('/:id/settings', async (req: Request, res: Response) => {
  try {
    const pluginManager = req.app.locals.pluginManager as PluginManager;
    const plugin = pluginManager.getPlugin(req.params.id);
    
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    
    const tenantId = req.headers['x-tenant-id'] as string;
    if (tenantId && plugin.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({ 
      settings: plugin.settings || {},
      schema: plugin.manifest.settings || []
    });
  } catch (error) {
    logger.error('Failed to get plugin settings:', error);
    res.status(500).json({ error: 'Failed to get plugin settings' });
  }
});

// Execute plugin hook
router.post('/:id/hooks/:hookName', async (req: Request, res: Response) => {
  try {
    const pluginManager = req.app.locals.pluginManager as PluginManager;
    const plugin = pluginManager.getPlugin(req.params.id);
    
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    
    const tenantId = req.headers['x-tenant-id'] as string;
    if (tenantId && plugin.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (plugin.status !== PluginStatus.ACTIVE) {
      return res.status(400).json({ error: 'Plugin is not active' });
    }
    
    const { hookName } = req.params;
    const context = req.body;
    
    if (!plugin.hooks.includes(hookName)) {
      return res.status(404).json({ error: 'Hook not found' });
    }
    
    const results = await pluginManager.executeHook(hookName, context);
    
    res.json({ results });
  } catch (error) {
    logger.error('Failed to execute plugin hook:', error);
    res.status(500).json({ 
      error: 'Failed to execute plugin hook',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get plugin logs
router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const pluginManager = req.app.locals.pluginManager as PluginManager;
    const plugin = pluginManager.getPlugin(req.params.id);
    
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    
    const tenantId = req.headers['x-tenant-id'] as string;
    if (tenantId && plugin.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // TODO: Implement plugin-specific logging
    res.json({ logs: [] });
  } catch (error) {
    logger.error('Failed to get plugin logs:', error);
    res.status(500).json({ error: 'Failed to get plugin logs' });
  }
});

export const pluginRoutes = router;