export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  email?: string;
  website?: string;
  license?: string;
  main?: string;
  platformVersion?: string;
  dependencies?: Record<string, string>;
  permissions?: string[];
  hooks?: string[];
  api?: Record<string, any>;
  settings?: PluginSetting[];
  assets?: string[];
  tags?: string[];
  category?: string;
  icon?: string;
  screenshots?: string[];
}

export interface PluginSetting {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  label: string;
  description?: string;
  default?: any;
  options?: { value: any; label: string }[];
  required?: boolean;
  validation?: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  manifest: PluginManifest;
  status: PluginStatus;
  installPath: string;
  installedBy: string;
  tenantId: string;
  installedAt: Date;
  activatedAt?: Date;
  deactivatedAt?: Date;
  dependencies: Record<string, string>;
  permissions: string[];
  hooks: string[];
  api: Record<string, any>;
  settings?: Record<string, any>;
  error?: string;
}

export enum PluginStatus {
  INSTALLED = 'installed',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  UPDATING = 'updating',
}

export interface PluginHook {
  pluginId: string;
  hookName: string;
  handler: string;
}

export interface PluginAPI {
  id: string;
  pluginId: string;
  endpoint: string;
  method: string;
  handler: string;
  permissions?: string[];
  rateLimit?: number;
}

export interface PluginEvent {
  type: 'installed' | 'activated' | 'deactivated' | 'uninstalled' | 'error';
  pluginId: string;
  plugin: Plugin;
  timestamp: Date;
  userId?: string;
  tenantId?: string;
  error?: string;
}

export interface PluginMarketplace {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  price: number;
  currency: string;
  rating: number;
  reviews: number;
  downloads: number;
  screenshots: string[];
  icon: string;
  publishedAt: Date;
  updatedAt: Date;
  compatibility: string[];
  fileUrl: string;
  fileSize: number;
  changelog?: string;
}

export interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginInstallation {
  id: string;
  pluginId: string;
  tenantId: string;
  userId: string;
  version: string;
  installedAt: Date;
  status: PluginStatus;
  settings?: Record<string, any>;
}