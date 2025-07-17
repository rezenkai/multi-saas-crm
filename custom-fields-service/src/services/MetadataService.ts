import { logger } from '../utils/logger';
import { DatabaseService } from './DatabaseService';
import { CustomField } from '../core/CustomFieldsManager';

export interface EntityMetadata {
  entity_type: string;
  tenant_id: string;
  fields: CustomField[];
  schema_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface FieldDefinition {
  name: string;
  type: string;
  required: boolean;
  default_value?: any;
  options?: Record<string, any>;
  validation_rules?: Record<string, any>;
}

export interface EntitySchema {
  entity_type: string;
  tenant_id: string;
  base_fields: FieldDefinition[];
  custom_fields: FieldDefinition[];
  relationships: Record<string, any>;
  indexes: string[];
}

export class MetadataService {
  private dbService: DatabaseService;
  private schemaCache: Map<string, EntitySchema> = new Map();
  private cacheExpiry: Map<string, Date> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.dbService = new DatabaseService();
  }

  /**
   * Получить схему сущности (базовые + кастомные поля)
   */
  async getEntitySchema(tenantId: string, entityType: string): Promise<EntitySchema> {
    const cacheKey = `${tenantId}:${entityType}`;
    
    // Проверяем кэш
    if (this.isInCache(cacheKey)) {
      return this.schemaCache.get(cacheKey)!;
    }

    try {
      // Получаем базовые поля
      const baseFields = this.getBaseEntityFields(entityType);
      
      // Получаем кастомные поля из БД
      const customFields = await this.dbService.getCustomFieldsByEntity(tenantId, entityType);
      
      const schema: EntitySchema = {
        entity_type: entityType,
        tenant_id: tenantId,
        base_fields: baseFields,
        custom_fields: customFields.map(field => this.convertToFieldDefinition(field)),
        relationships: this.getEntityRelationships(entityType),
        indexes: this.generateIndexes(entityType, customFields)
      };

      // Кэшируем результат
      this.cacheSchema(cacheKey, schema);
      
      logger.info('Entity schema generated', { tenant_id: tenantId, entity_type: entityType });
      
      return schema;
      
    } catch (error) {
      logger.error('Failed to get entity schema:', error);
      throw new Error(`Failed to get schema for ${entityType}`);
    }
  }

  /**
   * Обновить схему сущности (добавить/удалить кастомные поля)
   */
  async updateEntitySchema(tenantId: string, entityType: string, updates: {
    addFields?: FieldDefinition[];
    removeFields?: string[];
    modifyFields?: Partial<FieldDefinition>[];
  }): Promise<EntitySchema> {
    try {
      // Добавляем новые поля
      if (updates.addFields) {
        for (const field of updates.addFields) {
          await this.addCustomField(tenantId, entityType, field);
        }
      }

      // Удаляем поля
      if (updates.removeFields) {
        for (const fieldName of updates.removeFields) {
          await this.removeCustomField(tenantId, entityType, fieldName);
        }
      }

      // Модифицируем существующие поля
      if (updates.modifyFields) {
        for (const fieldUpdate of updates.modifyFields) {
          if (fieldUpdate.name) {
            await this.modifyCustomField(tenantId, entityType, fieldUpdate.name, fieldUpdate);
          }
        }
      }

      // Инвалидируем кэш и получаем обновленную схему
      this.invalidateCache(tenantId, entityType);
      
      return await this.getEntitySchema(tenantId, entityType);
      
    } catch (error) {
      logger.error('Failed to update entity schema:', error);
      throw new Error(`Failed to update schema for ${entityType}`);
    }
  }

  /**
   * Получить метаданные всех сущностей для тенанта
   */
  async getTenantMetadata(tenantId: string): Promise<EntityMetadata[]> {
    try {
      // Получаем список всех сущностей с кастомными полями
      const entities = await this.dbService.getEntitiesWithCustomFields(tenantId);
      
      const metadata: EntityMetadata[] = [];
      
      for (const entityType of entities) {
        const fields = await this.dbService.getCustomFieldsByEntity(tenantId, entityType);
        
        metadata.push({
          entity_type: entityType,
          tenant_id: tenantId,
          fields,
          schema_version: 1, // Можно добавить версионирование схем
          created_at: fields[0]?.created_at || new Date(),
          updated_at: fields[0]?.updated_at || new Date()
        });
      }
      
      return metadata;
      
    } catch (error) {
      logger.error('Failed to get tenant metadata:', error);
      throw new Error(`Failed to get metadata for tenant ${tenantId}`);
    }
  }

  /**
   * Валидация совместимости схемы
   */
  async validateSchemaCompatibility(tenantId: string, entityType: string, newField: FieldDefinition): Promise<{
    compatible: boolean;
    conflicts: string[];
    warnings: string[];
  }> {
    const conflicts: string[] = [];
    const warnings: string[] = [];

    try {
      const currentSchema = await this.getEntitySchema(tenantId, entityType);
      
      // Проверяем конфликты имен
      const allFields = [...currentSchema.base_fields, ...currentSchema.custom_fields];
      const existingField = allFields.find(f => f.name === newField.name);
      
      if (existingField) {
        conflicts.push(`Field '${newField.name}' already exists`);
      }

      // Проверяем зарезервированные имена
      const reservedNames = ['id', 'created_at', 'updated_at', 'tenant_id', 'deleted_at'];
      if (reservedNames.includes(newField.name.toLowerCase())) {
        conflicts.push(`Field name '${newField.name}' is reserved`);
      }

      // Проверяем ограничения по типам
      if (newField.type === 'json' && allFields.filter(f => f.type === 'json').length >= 10) {
        warnings.push('Too many JSON fields may impact performance');
      }

      return {
        compatible: conflicts.length === 0,
        conflicts,
        warnings
      };
      
    } catch (error) {
      logger.error('Schema compatibility validation failed:', error);
      return {
        compatible: false,
        conflicts: ['Failed to validate schema compatibility'],
        warnings: []
      };
    }
  }

  /**
   * Экспорт схемы в различных форматах
   */
  async exportSchema(tenantId: string, entityType: string, format: 'json' | 'sql' | 'typescript'): Promise<string> {
    const schema = await this.getEntitySchema(tenantId, entityType);
    
    switch (format) {
      case 'json':
        return JSON.stringify(schema, null, 2);
        
      case 'sql':
        return this.generateSQLSchema(schema);
        
      case 'typescript':
        return this.generateTypeScriptTypes(schema);
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Приватные методы

  private getBaseEntityFields(entityType: string): FieldDefinition[] {
    const commonFields: FieldDefinition[] = [
      { name: 'id', type: 'uuid', required: true },
      { name: 'tenant_id', type: 'uuid', required: true },
      { name: 'created_at', type: 'datetime', required: true },
      { name: 'updated_at', type: 'datetime', required: true }
    ];

    // Специфичные поля для каждого типа сущности
    switch (entityType) {
      case 'contact':
        return [
          ...commonFields,
          { name: 'first_name', type: 'text', required: true },
          { name: 'last_name', type: 'text', required: true },
          { name: 'email', type: 'email', required: false },
          { name: 'phone', type: 'text', required: false }
        ];
        
      case 'company':
        return [
          ...commonFields,
          { name: 'name', type: 'text', required: true },
          { name: 'website', type: 'url', required: false },
          { name: 'industry', type: 'text', required: false }
        ];
        
      case 'opportunity':
        return [
          ...commonFields,
          { name: 'name', type: 'text', required: true },
          { name: 'amount', type: 'number', required: false },
          { name: 'stage', type: 'select', required: true },
          { name: 'close_date', type: 'date', required: false }
        ];
        
      default:
        return commonFields;
    }
  }

  private getEntityRelationships(entityType: string): Record<string, any> {
    switch (entityType) {
      case 'contact':
        return {
          company: { type: 'belongs_to', entity: 'company' },
          opportunities: { type: 'has_many', entity: 'opportunity' }
        };
        
      case 'company':
        return {
          contacts: { type: 'has_many', entity: 'contact' },
          opportunities: { type: 'has_many', entity: 'opportunity' }
        };
        
      case 'opportunity':
        return {
          contact: { type: 'belongs_to', entity: 'contact' },
          company: { type: 'belongs_to', entity: 'company' }
        };
        
      default:
        return {};
    }
  }

  private generateIndexes(entityType: string, customFields: CustomField[]): string[] {
    const indexes = ['tenant_id', 'created_at'];
    
    // Добавляем индексы для часто используемых кастомных полей
    for (const field of customFields) {
      if (field.options?.indexed || field.field_type === 'select') {
        indexes.push(field.field_name);
      }
    }
    
    return indexes;
  }

  private convertToFieldDefinition(field: CustomField): FieldDefinition {
    return {
      name: field.field_name,
      type: field.field_type,
      required: field.required,
      default_value: field.default_value,
      options: field.options as Record<string, any>,
      validation_rules: field.validation_rules as Record<string, any>
    };
  }

  private async addCustomField(tenantId: string, entityType: string, field: FieldDefinition): Promise<void> {
    const customField: Partial<CustomField> = {
      tenant_id: tenantId,
      entity_type: entityType,
      field_name: field.name,
      field_type: field.type,
      required: field.required,
      default_value: field.default_value,
      options: field.options,
      validation_rules: field.validation_rules
    };
    
    await this.dbService.createCustomField(customField as CustomField);
  }

  private async removeCustomField(tenantId: string, entityType: string, fieldName: string): Promise<void> {
    const fields = await this.dbService.getCustomFieldsByEntity(tenantId, entityType);
    const field = fields.find(f => f.field_name === fieldName);
    
    if (field) {
      await this.dbService.deleteCustomField(field.id);
    }
  }

  private async modifyCustomField(tenantId: string, entityType: string, fieldName: string, updates: Partial<FieldDefinition>): Promise<void> {
    const fields = await this.dbService.getCustomFieldsByEntity(tenantId, entityType);
    const field = fields.find(f => f.field_name === fieldName);
    
    if (field) {
      const updatedField: Partial<CustomField> = {
        ...field,
        field_type: updates.type || field.field_type,
        required: updates.required !== undefined ? updates.required : field.required,
        default_value: updates.default_value !== undefined ? updates.default_value : field.default_value,
        options: updates.options || field.options,
        validation_rules: updates.validation_rules || field.validation_rules
      };
      
      await this.dbService.updateCustomField(field.id, updatedField);
    }
  }

  private isInCache(cacheKey: string): boolean {
    const expiry = this.cacheExpiry.get(cacheKey);
    if (!expiry || expiry < new Date()) {
      this.schemaCache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
      return false;
    }
    return this.schemaCache.has(cacheKey);
  }

  private cacheSchema(cacheKey: string, schema: EntitySchema): void {
    this.schemaCache.set(cacheKey, schema);
    this.cacheExpiry.set(cacheKey, new Date(Date.now() + this.CACHE_TTL));
  }

  private invalidateCache(tenantId: string, entityType?: string): void {
    if (entityType) {
      const cacheKey = `${tenantId}:${entityType}`;
      this.schemaCache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
    } else {
      // Инвалидируем все схемы для тенанта
      for (const [key] of this.schemaCache) {
        if (key.startsWith(`${tenantId}:`)) {
          this.schemaCache.delete(key);
          this.cacheExpiry.delete(key);
        }
      }
    }
  }

  private generateSQLSchema(schema: EntitySchema): string {
    const allFields = [...schema.base_fields, ...schema.custom_fields];
    
    let sql = `-- Generated schema for ${schema.entity_type}\n`;
    sql += `CREATE TABLE IF NOT EXISTS ${schema.entity_type}_custom_values (\n`;
    
    allFields.forEach((field, index) => {
      const sqlType = this.mapTypeToSQL(field.type);
      const nullable = field.required ? 'NOT NULL' : 'NULL';
      sql += `  ${field.name} ${sqlType} ${nullable}`;
      if (index < allFields.length - 1) sql += ',';
      sql += '\n';
    });
    
    sql += ');\n\n';
    
    // Добавляем индексы
    for (const indexField of schema.indexes) {
      sql += `CREATE INDEX IF NOT EXISTS idx_${schema.entity_type}_${indexField} ON ${schema.entity_type}_custom_values(${indexField});\n`;
    }
    
    return sql;
  }

  private generateTypeScriptTypes(schema: EntitySchema): string {
    const allFields = [...schema.base_fields, ...schema.custom_fields];
    
    let ts = `// Generated TypeScript types for ${schema.entity_type}\n\n`;
    ts += `export interface ${this.capitalize(schema.entity_type)} {\n`;
    
    allFields.forEach(field => {
      const tsType = this.mapTypeToTypeScript(field.type);
      const optional = field.required ? '' : '?';
      ts += `  ${field.name}${optional}: ${tsType};\n`;
    });
    
    ts += '}\n\n';
    
    ts += `export interface ${this.capitalize(schema.entity_type)}CreateRequest {\n`;
    allFields.filter(f => f.name !== 'id' && f.name !== 'created_at' && f.name !== 'updated_at').forEach(field => {
      const tsType = this.mapTypeToTypeScript(field.type);
      const optional = field.required ? '' : '?';
      ts += `  ${field.name}${optional}: ${tsType};\n`;
    });
    ts += '}\n';
    
    return ts;
  }

  private mapTypeToSQL(type: string): string {
    const mapping: Record<string, string> = {
      'text': 'VARCHAR(255)',
      'textarea': 'TEXT',
      'number': 'DECIMAL(10,2)',
      'date': 'DATE',
      'datetime': 'TIMESTAMP',
      'email': 'VARCHAR(255)',
      'url': 'TEXT',
      'boolean': 'BOOLEAN',
      'json': 'JSONB',
      'uuid': 'UUID',
      'select': 'VARCHAR(100)',
      'multiselect': 'JSONB'
    };
    
    return mapping[type] || 'TEXT';
  }

  private mapTypeToTypeScript(type: string): string {
    const mapping: Record<string, string> = {
      'text': 'string',
      'textarea': 'string',
      'number': 'number',
      'date': 'Date',
      'datetime': 'Date',
      'email': 'string',
      'url': 'string',
      'boolean': 'boolean',
      'json': 'Record<string, any>',
      'uuid': 'string',
      'select': 'string',
      'multiselect': 'string[]'
    };
    
    return mapping[type] || 'any';
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}