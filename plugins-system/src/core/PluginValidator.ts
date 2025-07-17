import Joi from 'joi';
import { PluginManifest } from '../types/plugin';
import { logger } from '../utils/logger';

export class PluginValidator {
  private manifestSchema: Joi.ObjectSchema;

  constructor() {
    this.manifestSchema = Joi.object({
      id: Joi.string().required().pattern(/^[a-zA-Z0-9-_]+$/).min(3).max(50),
      name: Joi.string().required().min(1).max(100),
      version: Joi.string().required().pattern(/^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/),
      description: Joi.string().required().min(10).max(500),
      author: Joi.string().required().min(1).max(100),
      email: Joi.string().email().optional(),
      website: Joi.string().uri().optional(),
      license: Joi.string().optional(),
      main: Joi.string().optional().default('index.js'),
      platformVersion: Joi.string().optional(),
      dependencies: Joi.object().pattern(
        Joi.string(),
        Joi.string().pattern(/^[\^~]?\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/)
      ).optional(),
      permissions: Joi.array().items(Joi.string()).optional(),
      hooks: Joi.array().items(Joi.string()).optional(),
      api: Joi.object().optional(),
      settings: Joi.array().items(Joi.object({
        key: Joi.string().required(),
        type: Joi.string().valid('string', 'number', 'boolean', 'select', 'multiselect').required(),
        label: Joi.string().required(),
        description: Joi.string().optional(),
        default: Joi.any().optional(),
        options: Joi.array().items(Joi.object({
          value: Joi.any().required(),
          label: Joi.string().required(),
        })).optional(),
        required: Joi.boolean().optional(),
        validation: Joi.string().optional(),
      })).optional(),
      assets: Joi.array().items(Joi.string()).optional(),
      tags: Joi.array().items(Joi.string()).optional(),
      category: Joi.string().optional(),
      icon: Joi.string().optional(),
      screenshots: Joi.array().items(Joi.string()).optional(),
    });
  }

  async validateManifest(manifest: PluginManifest): Promise<void> {
    try {
      const { error } = this.manifestSchema.validate(manifest, { abortEarly: false });
      
      if (error) {
        const errors = error.details.map(detail => detail.message);
        throw new Error(`Manifest validation failed: ${errors.join(', ')}`);
      }

      // Additional custom validations
      await this.validateCustomRules(manifest);
      
      logger.debug('Manifest validation successful', { pluginId: manifest.id });
    } catch (error) {
      logger.error('Manifest validation failed:', error);
      throw error;
    }
  }

  async validateCode(code: string): Promise<void> {
    try {
      // Basic syntax validation
      new Function(code);
      
      // Check for dangerous patterns
      const dangerousPatterns = [
        { pattern: /require\s*\(\s*['"]fs['"]/, message: 'File system access is not allowed' },
        { pattern: /require\s*\(\s*['"]child_process['"]/, message: 'Child process access is not allowed' },
        { pattern: /require\s*\(\s*['"]cluster['"]/, message: 'Cluster access is not allowed' },
        { pattern: /require\s*\(\s*['"]net['"]/, message: 'Network access is not allowed' },
        { pattern: /require\s*\(\s*['"]os['"]/, message: 'OS access is not allowed' },
        { pattern: /process\.exit/, message: 'Process exit is not allowed' },
        { pattern: /eval\s*\(/, message: 'Eval is not allowed' },
        { pattern: /Function\s*\(/, message: 'Function constructor is not allowed' },
        { pattern: /globalThis/, message: 'Global access is not allowed' },
        { pattern: /global\./, message: 'Global access is not allowed' },
        { pattern: /__dirname/, message: 'Directory access is not allowed' },
        { pattern: /__filename/, message: 'File access is not allowed' },
      ];

      const violations = dangerousPatterns.filter(({ pattern }) => pattern.test(code));
      
      if (violations.length > 0) {
        throw new Error(`Security violations found: ${violations.map(v => v.message).join(', ')}`);
      }

      logger.debug('Code validation successful');
    } catch (error) {
      logger.error('Code validation failed:', error);
      throw error;
    }
  }

  validatePermissions(permissions: string[]): boolean {
    const allowedPermissions = [
      'read:contacts',
      'write:contacts',
      'read:companies',
      'write:companies',
      'read:opportunities',
      'write:opportunities',
      'read:users',
      'write:users',
      'read:dashboard',
      'write:dashboard',
      'send:email',
      'send:sms',
      'access:api',
      'access:hooks',
      'access:storage',
      'access:events',
    ];

    return permissions.every(permission => allowedPermissions.includes(permission));
  }

  validateHooks(hooks: string[]): boolean {
    const allowedHooks = [
      'before:create:contact',
      'after:create:contact',
      'before:update:contact',
      'after:update:contact',
      'before:delete:contact',
      'after:delete:contact',
      'before:create:company',
      'after:create:company',
      'before:update:company',
      'after:update:company',
      'before:delete:company',
      'after:delete:company',
      'before:create:opportunity',
      'after:create:opportunity',
      'before:update:opportunity',
      'after:update:opportunity',
      'before:delete:opportunity',
      'after:delete:opportunity',
      'before:send:email',
      'after:send:email',
      'before:send:sms',
      'after:send:sms',
      'user:login',
      'user:logout',
      'dashboard:render',
      'page:render',
    ];

    return hooks.every(hook => allowedHooks.includes(hook));
  }

  validateSettings(settings: any[]): boolean {
    if (!Array.isArray(settings)) return false;

    return settings.every(setting => {
      // Check required fields
      if (!setting.key || !setting.type || !setting.label) {
        return false;
      }

      // Check valid types
      const validTypes = ['string', 'number', 'boolean', 'select', 'multiselect'];
      if (!validTypes.includes(setting.type)) {
        return false;
      }

      // Check select/multiselect options
      if (['select', 'multiselect'].includes(setting.type)) {
        if (!setting.options || !Array.isArray(setting.options)) {
          return false;
        }
        
        return setting.options.every((option: any) => 
          option.value !== undefined && option.label
        );
      }

      return true;
    });
  }

  private async validateCustomRules(manifest: PluginManifest): Promise<void> {
    // Check reserved plugin IDs
    const reservedIds = ['system', 'core', 'admin', 'api', 'auth', 'gateway'];
    if (reservedIds.includes(manifest.id)) {
      throw new Error(`Plugin ID '${manifest.id}' is reserved`);
    }

    // Validate permissions
    if (manifest.permissions && !this.validatePermissions(manifest.permissions)) {
      throw new Error('Invalid permissions detected');
    }

    // Validate hooks
    if (manifest.hooks && !this.validateHooks(manifest.hooks)) {
      throw new Error('Invalid hooks detected');
    }

    // Validate settings
    if (manifest.settings && !this.validateSettings(manifest.settings)) {
      throw new Error('Invalid settings configuration');
    }

    // Check for conflicting dependencies
    if (manifest.dependencies) {
      const deps = Object.keys(manifest.dependencies);
      const conflicts = deps.filter(dep => dep === manifest.id);
      if (conflicts.length > 0) {
        throw new Error('Plugin cannot depend on itself');
      }
    }

    // Validate API endpoints
    if (manifest.api) {
      const endpoints = Object.keys(manifest.api);
      const reservedEndpoints = ['/health', '/auth', '/admin'];
      
      const conflictingEndpoints = endpoints.filter(endpoint => 
        reservedEndpoints.some(reserved => endpoint.startsWith(reserved))
      );
      
      if (conflictingEndpoints.length > 0) {
        throw new Error(`API endpoints conflict with reserved paths: ${conflictingEndpoints.join(', ')}`);
      }
    }
  }

  validatePluginPackage(files: string[]): boolean {
    // Check required files
    const requiredFiles = ['manifest.json'];
    const hasRequiredFiles = requiredFiles.every(file => files.includes(file));
    
    if (!hasRequiredFiles) {
      return false;
    }

    // Check for potentially dangerous files
    const dangerousFiles = [
      '.env',
      'config.json',
      'secrets.json',
      'private.key',
      'id_rsa',
      'id_dsa',
    ];
    
    const hasDangerousFiles = dangerousFiles.some(file => 
      files.some(f => f.includes(file))
    );
    
    if (hasDangerousFiles) {
      return false;
    }

    // Check file extensions
    const allowedExtensions = ['.js', '.json', '.md', '.txt', '.css', '.html', '.png', '.jpg', '.jpeg', '.gif', '.svg'];
    const hasInvalidFiles = files.some(file => {
      const ext = file.substring(file.lastIndexOf('.'));
      return !allowedExtensions.includes(ext);
    });

    return !hasInvalidFiles;
  }

  sanitizeManifest(manifest: PluginManifest): PluginManifest {
    // Remove potentially dangerous properties
    const sanitized = { ...manifest };
    
    // Sanitize strings
    if (sanitized.description) {
      sanitized.description = sanitized.description.replace(/<[^>]*>/g, '');
    }
    
    if (sanitized.author) {
      sanitized.author = sanitized.author.replace(/<[^>]*>/g, '');
    }

    // Ensure safe defaults
    if (!sanitized.main) {
      sanitized.main = 'index.js';
    }

    // Limit permissions
    if (sanitized.permissions) {
      sanitized.permissions = sanitized.permissions.filter(perm => 
        this.validatePermissions([perm])
      );
    }

    // Limit hooks
    if (sanitized.hooks) {
      sanitized.hooks = sanitized.hooks.filter(hook => 
        this.validateHooks([hook])
      );
    }

    return sanitized;
  }
}