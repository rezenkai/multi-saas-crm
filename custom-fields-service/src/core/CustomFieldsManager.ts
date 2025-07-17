import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { DatabaseService } from '../services/DatabaseService';
import { ValidationService } from '../services/ValidationService';

export interface CustomField {
  id: string;
  tenant_id: string;
  entity_type: string;
  field_name: string;
  field_label?: string;
  label?: string;
  description?: string;
  field_type: 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'select' | 'multiselect' | 'textarea' | 'email' | 'phone' | 'url' | 'json';
  field_options?: string[]; // For select/multiselect
  options?: Record<string, any>; // Additional field options
  is_required?: boolean;
  required?: boolean;
  is_searchable?: boolean;
  is_active?: boolean;
  default_value?: any;
  validation_rules?: any;
  display_order?: number;
  created_at?: Date;
  updated_at?: Date;
  created_by?: string;
  updated_by?: string;
}

export interface CustomFieldValue {
  id: string;
  tenant_id: string;
  field_id: string;
  entity_type: string;
  entity_id: string;
  field_value: any;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
}

export class CustomFieldsManager {
  private db: DatabaseService;
  private validator: ValidationService;

  constructor() {
    this.db = new DatabaseService();
    this.validator = new ValidationService();
  }

  async createField(tenantId: string, userId: string, fieldData: Partial<CustomField>): Promise<CustomField> {
    try {
      // Validate field data
      const validationResult = this.validator.validateFieldDefinition(fieldData);
      if (!validationResult.valid) {
        throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Check if field name already exists for this entity
      const existingField = await this.db.findFieldByName(tenantId, fieldData.entity_type!, fieldData.field_name!);
      if (existingField) {
        throw new Error('Field name already exists for this entity');
      }

      const field: CustomField = {
        id: uuidv4(),
        tenant_id: tenantId,
        entity_type: fieldData.entity_type!,
        field_name: fieldData.field_name!,
        field_label: fieldData.field_label!,
        field_type: fieldData.field_type!,
        field_options: fieldData.field_options,
        is_required: fieldData.is_required || false,
        is_searchable: fieldData.is_searchable || false,
        is_active: fieldData.is_active !== false,
        default_value: fieldData.default_value,
        validation_rules: fieldData.validation_rules,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: userId,
        updated_by: userId
      };

      await this.db.createField(field);
      logger.info(`Custom field created: ${field.field_name} for entity ${field.entity_type}`);

      return field;
    } catch (error) {
      logger.error('Error creating custom field:', error);
      throw error;
    }
  }

  async updateField(tenantId: string, fieldId: string, userId: string, updates: Partial<CustomField>): Promise<CustomField | null> {
    try {
      const existingField = await this.db.findFieldById(tenantId, fieldId);
      if (!existingField) {
        return null;
      }

      // Validate updates
      const validationResult = this.validator.validateFieldDefinition(updates);
      if (!validationResult.valid) {
        throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
      }

      const updatedField: CustomField = {
        ...existingField,
        ...updates,
        updated_at: new Date(),
        updated_by: userId
      };

      await this.db.updateField(updatedField);
      logger.info(`Custom field updated: ${fieldId}`);

      return updatedField;
    } catch (error) {
      logger.error('Error updating custom field:', error);
      throw error;
    }
  }

  async deleteField(tenantId: string, fieldId: string, userId: string): Promise<boolean> {
    try {
      const existingField = await this.db.findFieldById(tenantId, fieldId);
      if (!existingField) {
        return false;
      }

      // Soft delete - mark as inactive
      await this.db.updateField({
        ...existingField,
        is_active: false,
        updated_at: new Date(),
        updated_by: userId
      });

      // Also delete all associated field values
      await this.db.deleteFieldValues(tenantId, fieldId);

      logger.info(`Custom field deleted: ${fieldId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting custom field:', error);
      throw error;
    }
  }

  async getFieldsForEntity(tenantId: string, entityType: string): Promise<CustomField[]> {
    try {
      const fields = await this.db.getFieldsForEntity(tenantId, entityType);
      return fields.filter(field => field.is_active);
    } catch (error) {
      logger.error('Error fetching fields for entity:', error);
      throw error;
    }
  }

  async getFieldValues(tenantId: string, entityType: string, entityId: string): Promise<Record<string, any>> {
    try {
      const values = await this.db.getFieldValues(tenantId, entityType, entityId);
      const fields = await this.getFieldsForEntity(tenantId, entityType);
      
      // Build response with field metadata
      const result: Record<string, any> = {};
      
      fields.forEach(field => {
        const value = values.find(v => v.field_id === field.id);
        result[field.field_name] = {
          field_id: field.id,
          field_type: field.field_type,
          field_label: field.field_label,
          value: value ? value.field_value : field.default_value,
          is_required: field.is_required,
          field_options: field.field_options
        };
      });

      return result;
    } catch (error) {
      logger.error('Error fetching field values:', error);
      throw error;
    }
  }

  async setFieldValues(tenantId: string, entityType: string, entityId: string, fieldValues: Record<string, any>, userId: string): Promise<boolean> {
    try {
      const fields = await this.getFieldsForEntity(tenantId, entityType);
      const existingValues = await this.db.getFieldValues(tenantId, entityType, entityId);

      for (const [fieldName, value] of Object.entries(fieldValues)) {
        const field = fields.find(f => f.field_name === fieldName);
        if (!field) {
          logger.warn(`Field ${fieldName} not found for entity ${entityType}`);
          continue;
        }

        // Validate field value
        this.validator.validateFieldValue(field, value);

        const existingValue = existingValues.find(v => v.field_id === field.id);
        
        if (existingValue) {
          // Update existing value
          await this.db.updateFieldValue({
            ...existingValue,
            field_value: value,
            updated_at: new Date(),
            updated_by: userId
          });
        } else {
          // Create new value
          const newValue: CustomFieldValue = {
            id: uuidv4(),
            tenant_id: tenantId,
            field_id: field.id,
            entity_type: entityType,
            entity_id: entityId,
            field_value: value,
            created_at: new Date(),
            updated_at: new Date(),
            created_by: userId,
            updated_by: userId
          };
          
          await this.db.createFieldValue(newValue);
        }
      }

      logger.info(`Field values set for ${entityType}:${entityId}`);
      return true;
    } catch (error) {
      logger.error('Error setting field values:', error);
      throw error;
    }
  }

  async validateRequiredFields(tenantId: string, entityType: string, entityId: string): Promise<string[]> {
    try {
      const fields = await this.getFieldsForEntity(tenantId, entityType);
      const values = await this.db.getFieldValues(tenantId, entityType, entityId);
      
      const missingFields: string[] = [];
      
      fields.forEach(field => {
        if (field.is_required) {
          const value = values.find(v => v.field_id === field.id);
          if (!value || value.field_value === null || value.field_value === undefined || value.field_value === '') {
            missingFields.push(field.field_name);
          }
        }
      });

      return missingFields;
    } catch (error) {
      logger.error('Error validating required fields:', error);
      throw error;
    }
  }
}