import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import yauzl from 'yauzl';
import semver from 'semver';
import chokidar from 'chokidar';
// Removed vm2 import for simplified implementation
import { logger } from '../utils/logger';
import { PluginRegistry } from './PluginRegistry';
import { PluginSandbox } from './PluginSandbox';
import { PluginValidator } from './PluginValidator';
import { Plugin, PluginManifest, PluginStatus, PluginHook } from '../types/plugin';

export class PluginManager extends EventEmitter {
  private plugins: Map<string, Plugin> = new Map();
  private pluginRegistry: PluginRegistry;
  private sandbox: PluginSandbox;
  private validator: PluginValidator;
  private hooks: Map<string, PluginHook[]> = new Map();
  private pluginsDir: string;
  private watcher?: chokidar.FSWatcher;

  constructor() {
    super();
    this.pluginsDir = path.join(__dirname, '../../plugins');
    this.pluginRegistry = new PluginRegistry();
    this.sandbox = new PluginSandbox();
    this.validator = new PluginValidator();
  }

  async initialize(): Promise<void> {
    try {
      // Ensure plugins directory exists
      await fs.mkdir(this.pluginsDir, { recursive: true });
      
      // Load existing plugins
      await this.loadPlugins();
      
      // Start watching for plugin changes
      this.startWatching();
      
      logger.info('Plugin manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize plugin manager:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      // Stop watching
      if (this.watcher) {
        await this.watcher.close();
      }

      // Unload all plugins
      for (const [id, plugin] of this.plugins) {
        await this.unloadPlugin(id);
      }

      logger.info('Plugin manager shutdown completed');
    } catch (error) {
      logger.error('Error during plugin manager shutdown:', error);
    }
  }

  async installPlugin(pluginPath: string, userId: string, tenantId: string): Promise<Plugin> {
    try {
      // Extract plugin
      const extractedPath = await this.extractPlugin(pluginPath);
      
      // Load and validate manifest
      const manifest = await this.loadManifest(extractedPath);
      await this.validator.validateManifest(manifest);

      // Check compatibility
      if (!this.isCompatible(manifest)) {
        throw new Error(`Plugin ${manifest.name} is not compatible with current platform version`);
      }

      // Check for conflicts
      const existingPlugin = this.plugins.get(manifest.id);
      if (existingPlugin && existingPlugin.status === PluginStatus.ACTIVE) {
        throw new Error(`Plugin ${manifest.name} is already installed and active`);
      }

      // Create plugin instance
      const plugin: Plugin = {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        manifest,
        status: PluginStatus.INSTALLED,
        installPath: extractedPath,
        installedBy: userId,
        tenantId,
        installedAt: new Date(),
        dependencies: manifest.dependencies || {},
        permissions: manifest.permissions || [],
        hooks: manifest.hooks || [],
        api: manifest.api || {},
      };

      // Register plugin
      await this.pluginRegistry.register(plugin);
      this.plugins.set(plugin.id, plugin);

      // Load plugin code
      await this.loadPlugin(plugin);

      logger.info(`Plugin ${plugin.name} installed successfully`, {
        pluginId: plugin.id,
        version: plugin.version,
        userId,
        tenantId,
      });

      this.emit('plugin:installed', plugin);
      return plugin;
    } catch (error) {
      logger.error('Plugin installation failed:', error);
      
      // Cleanup on failure
      try {
        await fs.rm(path.dirname(pluginPath), { recursive: true, force: true });
      } catch (cleanupError) {
        logger.error('Failed to cleanup after plugin installation failure:', cleanupError);
      }
      
      throw error;
    }
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    try {
      // Unload plugin
      await this.unloadPlugin(pluginId);

      // Remove from registry
      await this.pluginRegistry.unregister(pluginId);

      // Remove files
      await fs.rm(plugin.installPath, { recursive: true, force: true });

      // Remove from memory
      this.plugins.delete(pluginId);

      logger.info(`Plugin ${plugin.name} uninstalled successfully`, {
        pluginId: plugin.id,
        version: plugin.version,
      });

      this.emit('plugin:uninstalled', plugin);
    } catch (error) {
      logger.error('Plugin uninstallation failed:', error);
      throw error;
    }
  }

  async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (plugin.status === PluginStatus.ACTIVE) {
      throw new Error(`Plugin ${plugin.name} is already active`);
    }

    try {
      // Check dependencies
      await this.checkDependencies(plugin);

      // Load plugin code
      await this.loadPlugin(plugin);

      // Update status
      plugin.status = PluginStatus.ACTIVE;
      plugin.activatedAt = new Date();

      // Update registry
      await this.pluginRegistry.updateStatus(pluginId, PluginStatus.ACTIVE);

      logger.info(`Plugin ${plugin.name} activated successfully`, {
        pluginId: plugin.id,
        version: plugin.version,
      });

      this.emit('plugin:activated', plugin);
    } catch (error) {
      plugin.status = PluginStatus.ERROR;
      plugin.error = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Plugin activation failed:', error);
      throw error;
    }
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (plugin.status !== PluginStatus.ACTIVE) {
      throw new Error(`Plugin ${plugin.name} is not active`);
    }

    try {
      // Unload plugin
      await this.unloadPlugin(pluginId);

      // Update status
      plugin.status = PluginStatus.INACTIVE;
      plugin.deactivatedAt = new Date();

      // Update registry
      await this.pluginRegistry.updateStatus(pluginId, PluginStatus.INACTIVE);

      logger.info(`Plugin ${plugin.name} deactivated successfully`, {
        pluginId: plugin.id,
        version: plugin.version,
      });

      this.emit('plugin:deactivated', plugin);
    } catch (error) {
      logger.error('Plugin deactivation failed:', error);
      throw error;
    }
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getActivePlugins(): Plugin[] {
    return this.getPlugins().filter(plugin => plugin.status === PluginStatus.ACTIVE);
  }

  async executeHook(hookName: string, context: any): Promise<any[]> {
    const hookPlugins = this.hooks.get(hookName) || [];
    const results: any[] = [];

    for (const hook of hookPlugins) {
      try {
        const result = await this.sandbox.execute(hook.handler, context);
        results.push(result);
      } catch (error) {
        logger.error(`Hook execution failed for ${hookName}:`, error);
      }
    }

    return results;
  }

  registerHook(pluginId: string, hookName: string, handler: string): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }

    this.hooks.get(hookName)!.push({
      pluginId,
      hookName,
      handler,
    });
  }

  unregisterHooks(pluginId: string): void {
    for (const [hookName, hooks] of this.hooks) {
      const filteredHooks = hooks.filter(hook => hook.pluginId !== pluginId);
      this.hooks.set(hookName, filteredHooks);
    }
  }

  private async loadPlugins(): Promise<void> {
    try {
      const plugins = await this.pluginRegistry.getAll();
      
      for (const plugin of plugins) {
        this.plugins.set(plugin.id, plugin);
        
        if (plugin.status === PluginStatus.ACTIVE) {
          try {
            await this.loadPlugin(plugin);
          } catch (error) {
            logger.error(`Failed to load plugin ${plugin.name}:`, error);
            plugin.status = PluginStatus.ERROR;
            plugin.error = error instanceof Error ? error.message : 'Unknown error';
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load plugins:', error);
    }
  }

  private async loadPlugin(plugin: Plugin): Promise<void> {
    try {
      const mainFile = path.join(plugin.installPath, plugin.manifest.main || 'index.js');
      const pluginCode = await fs.readFile(mainFile, 'utf8');

      // Execute plugin in sandbox
      const result = await this.sandbox.execute(pluginCode, {
        plugin: plugin.manifest,
        registerHook: (hookName: string, handler: string) => {
          this.registerHook(plugin.id, hookName, handler);
        },
        logger,
      });

      // Register hooks
      if (plugin.manifest.hooks) {
        for (const hookName of plugin.manifest.hooks) {
          // Hook registration is handled in sandbox execution
        }
      }

      plugin.status = PluginStatus.ACTIVE;
      plugin.activatedAt = new Date();

      logger.debug(`Plugin ${plugin.name} loaded successfully`);
    } catch (error) {
      plugin.status = PluginStatus.ERROR;
      plugin.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  private async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    try {
      // Unregister hooks
      this.unregisterHooks(pluginId);

      // Update status
      plugin.status = PluginStatus.INACTIVE;
      plugin.deactivatedAt = new Date();

      logger.debug(`Plugin ${plugin.name} unloaded successfully`);
    } catch (error) {
      logger.error(`Failed to unload plugin ${plugin.name}:`, error);
    }
  }

  private async extractPlugin(pluginPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const extractPath = path.join(this.pluginsDir, path.basename(pluginPath, path.extname(pluginPath)));
      
      yauzl.open(pluginPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);

        zipfile.readEntry();
        zipfile.on('entry', (entry) => {
          if (/\/$/.test(entry.fileName)) {
            // Directory entry
            zipfile.readEntry();
          } else {
            // File entry
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) return reject(err);

              const filePath = path.join(extractPath, entry.fileName);
              const dirPath = path.dirname(filePath);

              fs.mkdir(dirPath, { recursive: true }).then(() => {
                const writeStream = require('fs').createWriteStream(filePath);
                readStream.pipe(writeStream);
                writeStream.on('close', () => {
                  zipfile.readEntry();
                });
              }).catch(reject);
            });
          }
        });

        zipfile.on('end', () => {
          resolve(extractPath);
        });

        zipfile.on('error', reject);
      });
    });
  }

  private async loadManifest(pluginPath: string): Promise<PluginManifest> {
    const manifestPath = path.join(pluginPath, 'manifest.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    return JSON.parse(manifestContent);
  }

  private isCompatible(manifest: PluginManifest): boolean {
    if (!manifest.platformVersion) return true;
    
    const currentVersion = process.env.PLATFORM_VERSION || '1.0.0';
    return semver.satisfies(currentVersion, manifest.platformVersion);
  }

  private async checkDependencies(plugin: Plugin): Promise<void> {
    if (!plugin.dependencies) return;

    for (const [depId, depVersion] of Object.entries(plugin.dependencies)) {
      const depPlugin = this.plugins.get(depId);
      
      if (!depPlugin) {
        throw new Error(`Dependency ${depId} not found`);
      }

      if (depPlugin.status !== PluginStatus.ACTIVE) {
        throw new Error(`Dependency ${depId} is not active`);
      }

      if (!semver.satisfies(depPlugin.version, depVersion)) {
        throw new Error(`Dependency ${depId} version ${depPlugin.version} does not satisfy ${depVersion}`);
      }
    }
  }

  private startWatching(): void {
    this.watcher = chokidar.watch(this.pluginsDir, {
      ignored: /node_modules|\.git/,
      persistent: true,
    });

    this.watcher.on('change', (filePath) => {
      // Handle plugin file changes
      logger.debug(`Plugin file changed: ${filePath}`);
      // Implement hot reloading if needed
    });

    this.watcher.on('add', (filePath) => {
      // Handle new plugin files
      logger.debug(`Plugin file added: ${filePath}`);
    });

    this.watcher.on('unlink', (filePath) => {
      // Handle plugin file removal
      logger.debug(`Plugin file removed: ${filePath}`);
    });
  }
}