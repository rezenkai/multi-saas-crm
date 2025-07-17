import fs from 'fs/promises';
import path from 'path';
import { Plugin, PluginStatus, PluginInstallation } from '../types/plugin';
import { logger } from '../utils/logger';

export class PluginRegistry {
  private registryPath: string;
  private installationsPath: string;

  constructor() {
    this.registryPath = path.join(__dirname, '../../data/registry.json');
    this.installationsPath = path.join(__dirname, '../../data/installations.json');
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.registryPath), { recursive: true });
      
      // Initialize registry file if it doesn't exist
      try {
        await fs.access(this.registryPath);
      } catch {
        await fs.writeFile(this.registryPath, JSON.stringify([], null, 2));
      }

      // Initialize installations file if it doesn't exist
      try {
        await fs.access(this.installationsPath);
      } catch {
        await fs.writeFile(this.installationsPath, JSON.stringify([], null, 2));
      }
    } catch (error) {
      logger.error('Failed to initialize plugin registry:', error);
      throw error;
    }
  }

  async register(plugin: Plugin): Promise<void> {
    try {
      const plugins = await this.getAll();
      
      // Remove existing plugin with same ID
      const filteredPlugins = plugins.filter(p => p.id !== plugin.id);
      
      // Add new plugin
      filteredPlugins.push(plugin);
      
      // Save to registry
      await fs.writeFile(this.registryPath, JSON.stringify(filteredPlugins, null, 2));
      
      // Record installation
      await this.recordInstallation(plugin);
      
      logger.info(`Plugin ${plugin.name} registered successfully`);
    } catch (error) {
      logger.error('Failed to register plugin:', error);
      throw error;
    }
  }

  async unregister(pluginId: string): Promise<void> {
    try {
      const plugins = await this.getAll();
      const filteredPlugins = plugins.filter(p => p.id !== pluginId);
      
      await fs.writeFile(this.registryPath, JSON.stringify(filteredPlugins, null, 2));
      
      logger.info(`Plugin ${pluginId} unregistered successfully`);
    } catch (error) {
      logger.error('Failed to unregister plugin:', error);
      throw error;
    }
  }

  async getAll(): Promise<Plugin[]> {
    try {
      await this.initialize();
      const content = await fs.readFile(this.registryPath, 'utf8');
      const plugins = JSON.parse(content) as Plugin[];
      
      // Convert date strings back to Date objects
      return plugins.map(plugin => ({
        ...plugin,
        installedAt: new Date(plugin.installedAt),
        activatedAt: plugin.activatedAt ? new Date(plugin.activatedAt) : undefined,
        deactivatedAt: plugin.deactivatedAt ? new Date(plugin.deactivatedAt) : undefined,
      }));
    } catch (error) {
      logger.error('Failed to get all plugins:', error);
      return [];
    }
  }

  async getById(pluginId: string): Promise<Plugin | null> {
    try {
      const plugins = await this.getAll();
      return plugins.find(p => p.id === pluginId) || null;
    } catch (error) {
      logger.error('Failed to get plugin by ID:', error);
      return null;
    }
  }

  async getByTenant(tenantId: string): Promise<Plugin[]> {
    try {
      const plugins = await this.getAll();
      return plugins.filter(p => p.tenantId === tenantId);
    } catch (error) {
      logger.error('Failed to get plugins by tenant:', error);
      return [];
    }
  }

  async getByStatus(status: PluginStatus): Promise<Plugin[]> {
    try {
      const plugins = await this.getAll();
      return plugins.filter(p => p.status === status);
    } catch (error) {
      logger.error('Failed to get plugins by status:', error);
      return [];
    }
  }

  async updateStatus(pluginId: string, status: PluginStatus): Promise<void> {
    try {
      const plugins = await this.getAll();
      const plugin = plugins.find(p => p.id === pluginId);
      
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      plugin.status = status;
      
      if (status === PluginStatus.ACTIVE) {
        plugin.activatedAt = new Date();
      } else if (status === PluginStatus.INACTIVE) {
        plugin.deactivatedAt = new Date();
      }

      await fs.writeFile(this.registryPath, JSON.stringify(plugins, null, 2));
      
      logger.info(`Plugin ${pluginId} status updated to ${status}`);
    } catch (error) {
      logger.error('Failed to update plugin status:', error);
      throw error;
    }
  }

  async updateSettings(pluginId: string, settings: Record<string, any>): Promise<void> {
    try {
      const plugins = await this.getAll();
      const plugin = plugins.find(p => p.id === pluginId);
      
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      plugin.settings = { ...plugin.settings, ...settings };
      
      await fs.writeFile(this.registryPath, JSON.stringify(plugins, null, 2));
      
      logger.info(`Plugin ${pluginId} settings updated`);
    } catch (error) {
      logger.error('Failed to update plugin settings:', error);
      throw error;
    }
  }

  async recordInstallation(plugin: Plugin): Promise<void> {
    try {
      const installations = await this.getInstallations();
      
      const installation: PluginInstallation = {
        id: `${plugin.id}-${plugin.tenantId}-${Date.now()}`,
        pluginId: plugin.id,
        tenantId: plugin.tenantId,
        userId: plugin.installedBy,
        version: plugin.version,
        installedAt: plugin.installedAt,
        status: plugin.status,
        settings: plugin.settings,
      };

      installations.push(installation);
      
      await fs.writeFile(this.installationsPath, JSON.stringify(installations, null, 2));
      
      logger.info(`Installation recorded for plugin ${plugin.name}`);
    } catch (error) {
      logger.error('Failed to record installation:', error);
      throw error;
    }
  }

  async getInstallations(): Promise<PluginInstallation[]> {
    try {
      await this.initialize();
      const content = await fs.readFile(this.installationsPath, 'utf8');
      const installations = JSON.parse(content) as PluginInstallation[];
      
      // Convert date strings back to Date objects
      return installations.map(installation => ({
        ...installation,
        installedAt: new Date(installation.installedAt),
      }));
    } catch (error) {
      logger.error('Failed to get installations:', error);
      return [];
    }
  }

  async getInstallationsByTenant(tenantId: string): Promise<PluginInstallation[]> {
    try {
      const installations = await this.getInstallations();
      return installations.filter(i => i.tenantId === tenantId);
    } catch (error) {
      logger.error('Failed to get installations by tenant:', error);
      return [];
    }
  }

  async getInstallationsByPlugin(pluginId: string): Promise<PluginInstallation[]> {
    try {
      const installations = await this.getInstallations();
      return installations.filter(i => i.pluginId === pluginId);
    } catch (error) {
      logger.error('Failed to get installations by plugin:', error);
      return [];
    }
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    error: number;
    byTenant: Record<string, number>;
    topPlugins: Array<{ pluginId: string; installations: number }>;
  }> {
    try {
      const plugins = await this.getAll();
      const installations = await this.getInstallations();
      
      const stats = {
        total: plugins.length,
        active: plugins.filter(p => p.status === PluginStatus.ACTIVE).length,
        inactive: plugins.filter(p => p.status === PluginStatus.INACTIVE).length,
        error: plugins.filter(p => p.status === PluginStatus.ERROR).length,
        byTenant: {} as Record<string, number>,
        topPlugins: [] as Array<{ pluginId: string; installations: number }>,
      };

      // Count by tenant
      plugins.forEach(plugin => {
        stats.byTenant[plugin.tenantId] = (stats.byTenant[plugin.tenantId] || 0) + 1;
      });

      // Top plugins by installation count
      const pluginCounts = new Map<string, number>();
      installations.forEach(installation => {
        pluginCounts.set(
          installation.pluginId,
          (pluginCounts.get(installation.pluginId) || 0) + 1
        );
      });

      stats.topPlugins = Array.from(pluginCounts.entries())
        .map(([pluginId, installations]) => ({ pluginId, installations }))
        .sort((a, b) => b.installations - a.installations)
        .slice(0, 10);

      return stats;
    } catch (error) {
      logger.error('Failed to get plugin stats:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        error: 0,
        byTenant: {},
        topPlugins: [],
      };
    }
  }
}