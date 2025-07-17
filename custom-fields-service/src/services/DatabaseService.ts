import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { CustomField, CustomFieldValue } from '../core/CustomFieldsManager';

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      ssl: config.environment === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async findFieldByName(tenantId: string, entityType: string, fieldName: string): Promise<CustomField | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM custom_fields WHERE tenant_id = $1 AND entity_type = $2 AND field_name = $3 AND is_active = true',
        [tenantId, entityType, fieldName]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding field by name:', error);
      return null;
    }
  }

  async findFieldById(tenantId: string, fieldId: string): Promise<CustomField | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM custom_fields WHERE tenant_id = $1 AND id = $2',
        [tenantId, fieldId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding field by ID:', error);
      return null;
    }
  }

  async createField(field: CustomField): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO custom_fields (
          id, tenant_id, entity_type, field_name, field_label, field_type,
          field_options, is_required, is_searchable, is_active, default_value,
          validation_rules, created_at, updated_at, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        field.id, field.tenant_id, field.entity_type, field.field_name,
        field.field_label, field.field_type, JSON.stringify(field.field_options),
        field.is_required, field.is_searchable, field.is_active, 
        JSON.stringify(field.default_value), JSON.stringify(field.validation_rules),
        field.created_at, field.updated_at, field.created_by, field.updated_by
      ]);
    } catch (error) {
      logger.error('Error creating field:', error);
      throw error;
    }
  }

  async updateField(field: CustomField): Promise<void> {
    try {
      await this.pool.query(`
        UPDATE custom_fields SET
          field_label = $3, field_type = $4, field_options = $5,
          is_required = $6, is_searchable = $7, is_active = $8,
          default_value = $9, validation_rules = $10, updated_at = $11, updated_by = $12
        WHERE tenant_id = $1 AND id = $2
      `, [
        field.tenant_id, field.id, field.field_label, field.field_type,
        JSON.stringify(field.field_options), field.is_required, field.is_searchable,
        field.is_active, JSON.stringify(field.default_value), 
        JSON.stringify(field.validation_rules), field.updated_at, field.updated_by
      ]);
    } catch (error) {
      logger.error('Error updating field:', error);
      throw error;
    }
  }

  async getFieldsForEntity(tenantId: string, entityType: string): Promise<CustomField[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM custom_fields WHERE tenant_id = $1 AND entity_type = $2 ORDER BY created_at',
        [tenantId, entityType]
      );
      
      return result.rows.map(row => ({
        ...row,
        field_options: row.field_options ? JSON.parse(row.field_options) : null,
        default_value: row.default_value ? JSON.parse(row.default_value) : null,
        validation_rules: row.validation_rules ? JSON.parse(row.validation_rules) : null
      }));
    } catch (error) {
      logger.error('Error getting fields for entity:', error);
      return [];
    }
  }

  async getFieldValues(tenantId: string, entityType: string, entityId: string): Promise<CustomFieldValue[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM custom_field_values WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3',
        [tenantId, entityType, entityId]
      );
      
      return result.rows.map(row => ({
        ...row,
        field_value: row.field_value ? JSON.parse(row.field_value) : null
      }));
    } catch (error) {
      logger.error('Error getting field values:', error);
      return [];
    }
  }

  async createFieldValue(value: CustomFieldValue): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO custom_field_values (
          id, tenant_id, field_id, entity_type, entity_id, field_value,
          created_at, updated_at, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        value.id, value.tenant_id, value.field_id, value.entity_type,
        value.entity_id, JSON.stringify(value.field_value),
        value.created_at, value.updated_at, value.created_by, value.updated_by
      ]);
    } catch (error) {
      logger.error('Error creating field value:', error);
      throw error;
    }
  }

  async updateFieldValue(value: CustomFieldValue): Promise<void> {
    try {
      await this.pool.query(`
        UPDATE custom_field_values SET
          field_value = $3, updated_at = $4, updated_by = $5
        WHERE tenant_id = $1 AND id = $2
      `, [
        value.tenant_id, value.id, JSON.stringify(value.field_value),
        value.updated_at, value.updated_by
      ]);
    } catch (error) {
      logger.error('Error updating field value:', error);
      throw error;
    }
  }

  async deleteFieldValues(tenantId: string, fieldId: string): Promise<void> {
    try {
      await this.pool.query(
        'DELETE FROM custom_field_values WHERE tenant_id = $1 AND field_id = $2',
        [tenantId, fieldId]
      );
    } catch (error) {
      logger.error('Error deleting field values:', error);
      throw error;
    }
  }

  async getCustomFieldsByEntity(tenantId: string, entityType: string): Promise<CustomField[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM custom_fields WHERE tenant_id = $1 AND entity_type = $2 AND is_active = true ORDER BY display_order, field_name',
        [tenantId, entityType]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting custom fields by entity:', error);
      return [];
    }
  }

  async getEntitiesWithCustomFields(tenantId: string): Promise<string[]> {
    try {
      const result = await this.pool.query(
        'SELECT DISTINCT entity_type FROM custom_fields WHERE tenant_id = $1 AND is_active = true',
        [tenantId]
      );
      
      return result.rows.map(row => row.entity_type);
    } catch (error) {
      logger.error('Error getting entities with custom fields:', error);
      return [];
    }
  }

  async createCustomField(field: CustomField): Promise<CustomField> {
    try {
      const result = await this.pool.query(`
        INSERT INTO custom_fields (
          id, tenant_id, entity_type, field_name, field_type,
          label, description, required, default_value, options,
          validation_rules, display_order, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `, [
        field.id,
        field.tenant_id,
        field.entity_type,
        field.field_name,
        field.field_type,
        field.label,
        field.description,
        field.required || false,
        field.default_value,
        JSON.stringify(field.options || {}),
        JSON.stringify(field.validation_rules || {}),
        field.display_order || 0,
        field.is_active !== false,
        new Date(),
        new Date()
      ]);
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating custom field:', error);
      throw error;
    }
  }

  async updateCustomField(fieldId: string, updates: Partial<CustomField>): Promise<CustomField | null> {
    try {
      const result = await this.pool.query(`
        UPDATE custom_fields 
        SET field_type = COALESCE($2, field_type),
            label = COALESCE($3, label),
            description = COALESCE($4, description),
            required = COALESCE($5, required),
            default_value = COALESCE($6, default_value),
            options = COALESCE($7, options),
            validation_rules = COALESCE($8, validation_rules),
            display_order = COALESCE($9, display_order),
            is_active = COALESCE($10, is_active),
            updated_at = $11
        WHERE id = $1
        RETURNING *
      `, [
        fieldId,
        updates.field_type,
        updates.label,
        updates.description,
        updates.required,
        updates.default_value,
        updates.options ? JSON.stringify(updates.options) : null,
        updates.validation_rules ? JSON.stringify(updates.validation_rules) : null,
        updates.display_order,
        updates.is_active,
        new Date()
      ]);
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error updating custom field:', error);
      throw error;
    }
  }

  async deleteCustomField(fieldId: string): Promise<void> {
    try {
      await this.pool.query(
        'UPDATE custom_fields SET is_active = false, updated_at = $2 WHERE id = $1',
        [fieldId, new Date()]
      );
    } catch (error) {
      logger.error('Error deleting custom field:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}