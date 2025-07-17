import { logger } from '../utils/logger';
import { CustomField, CustomFieldValue } from '../core/CustomFieldsManager';

export interface ValidationRule {
  type: 'required' | 'min_length' | 'max_length' | 'regex' | 'numeric_range' | 'date_range' | 'email' | 'url';
  value?: any;
  message?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class ValidationService {
  
  /**
   * Валидация значения кастомного поля
   */
  validateFieldValue(field: CustomField, value: any): ValidationResult {
    const errors: string[] = [];
    
    try {
      // Проверка обязательности поля
      if (field.required && this.isEmpty(value)) {
        errors.push(`Field '${field.field_name}' is required`);
        return { valid: false, errors };
      }
      
      // Если поле пустое и не обязательное - валидация пройдена
      if (this.isEmpty(value)) {
        return { valid: true, errors: [] };
      }
      
      // Валидация по типу поля
      switch (field.field_type) {
        case 'text':
        case 'textarea':
          this.validateText(field, value, errors);
          break;
          
        case 'number':
          this.validateNumber(field, value, errors);
          break;
          
        case 'date':
        case 'datetime':
          this.validateDate(field, value, errors);
          break;
          
        case 'email':
          this.validateEmail(field, value, errors);
          break;
          
        case 'url':
          this.validateUrl(field, value, errors);
          break;
          
        case 'select':
        case 'multiselect':
          this.validateSelect(field, value, errors);
          break;
          
        case 'boolean':
          this.validateBoolean(field, value, errors);
          break;
          
        case 'json':
          this.validateJson(field, value, errors);
          break;
          
        default:
          logger.warn(`Unknown field type: ${field.field_type}`, { field_id: field.id });
      }
      
      // Дополнительные правила валидации
      if (field.validation_rules) {
        this.applyCustomValidationRules(field, value, errors);
      }
      
    } catch (error) {
      logger.error('Validation error:', error);
      errors.push('Internal validation error');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Валидация нескольких полей
   */
  validateFields(fields: CustomField[], values: Record<string, any>): ValidationResult {
    const allErrors: string[] = [];
    
    for (const field of fields) {
      const value = values[field.field_name];
      const result = this.validateFieldValue(field, value);
      allErrors.push(...result.errors);
    }
    
    return {
      valid: allErrors.length === 0,
      errors: allErrors
    };
  }
  
  /**
   * Валидация схемы кастомного поля
   */
  validateFieldDefinition(field: Partial<CustomField>): ValidationResult {
    const errors: string[] = [];
    
    // Обязательные поля
    if (!field.field_name) {
      errors.push('Field name is required');
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.field_name)) {
      errors.push('Field name must start with letter and contain only letters, numbers and underscores');
    }
    
    if (!field.field_type) {
      errors.push('Field type is required');
    } else if (!this.isValidFieldType(field.field_type)) {
      errors.push(`Invalid field type: ${field.field_type}`);
    }
    
    if (!field.entity_type) {
      errors.push('Entity type is required');
    }
    
    // Валидация опций для select полей
    if ((field.field_type === 'select' || field.field_type === 'multiselect') && 
        (!field.options || !Array.isArray(field.options) || field.options.length === 0)) {
      errors.push('Select fields must have at least one option');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  // Приватные методы валидации
  
  private isEmpty(value: any): boolean {
    return value === null || value === undefined || value === '';
  }
  
  private validateText(field: CustomField, value: any, errors: string[]): void {
    if (typeof value !== 'string') {
      errors.push(`Field '${field.field_name}' must be a string`);
      return;
    }
    
    const options = field.options || {};
    
    if (options.min_length && value.length < options.min_length) {
      errors.push(`Field '${field.field_name}' must be at least ${options.min_length} characters`);
    }
    
    if (options.max_length && value.length > options.max_length) {
      errors.push(`Field '${field.field_name}' must be no more than ${options.max_length} characters`);
    }
    
    if (options.pattern && !new RegExp(options.pattern).test(value)) {
      errors.push(`Field '${field.field_name}' does not match required pattern`);
    }
  }
  
  private validateNumber(field: CustomField, value: any, errors: string[]): void {
    const numValue = Number(value);
    
    if (isNaN(numValue)) {
      errors.push(`Field '${field.field_name}' must be a valid number`);
      return;
    }
    
    const options = field.options || {};
    
    if (options.min !== undefined && numValue < options.min) {
      errors.push(`Field '${field.field_name}' must be at least ${options.min}`);
    }
    
    if (options.max !== undefined && numValue > options.max) {
      errors.push(`Field '${field.field_name}' must be no more than ${options.max}`);
    }
  }
  
  private validateDate(field: CustomField, value: any, errors: string[]): void {
    const date = new Date(value);
    
    if (isNaN(date.getTime())) {
      errors.push(`Field '${field.field_name}' must be a valid date`);
      return;
    }
    
    const options = field.options || {};
    
    if (options.min_date) {
      const minDate = new Date(options.min_date);
      if (date < minDate) {
        errors.push(`Field '${field.field_name}' must be after ${options.min_date}`);
      }
    }
    
    if (options.max_date) {
      const maxDate = new Date(options.max_date);
      if (date > maxDate) {
        errors.push(`Field '${field.field_name}' must be before ${options.max_date}`);
      }
    }
  }
  
  private validateEmail(field: CustomField, value: any, errors: string[]): void {
    if (typeof value !== 'string') {
      errors.push(`Field '${field.field_name}' must be a string`);
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      errors.push(`Field '${field.field_name}' must be a valid email address`);
    }
  }
  
  private validateUrl(field: CustomField, value: any, errors: string[]): void {
    if (typeof value !== 'string') {
      errors.push(`Field '${field.field_name}' must be a string`);
      return;
    }
    
    try {
      new URL(value);
    } catch {
      errors.push(`Field '${field.field_name}' must be a valid URL`);
    }
  }
  
  private validateSelect(field: CustomField, value: any, errors: string[]): void {
    const options = field.options || {};
    const validOptions = options.choices || [];
    
    if (field.field_type === 'select') {
      if (!validOptions.includes(value)) {
        errors.push(`Field '${field.field_name}' must be one of: ${validOptions.join(', ')}`);
      }
    } else if (field.field_type === 'multiselect') {
      if (!Array.isArray(value)) {
        errors.push(`Field '${field.field_name}' must be an array`);
        return;
      }
      
      for (const item of value) {
        if (!validOptions.includes(item)) {
          errors.push(`Field '${field.field_name}' contains invalid option: ${item}`);
        }
      }
    }
  }
  
  private validateBoolean(field: CustomField, value: any, errors: string[]): void {
    if (typeof value !== 'boolean') {
      errors.push(`Field '${field.field_name}' must be a boolean (true/false)`);
    }
  }
  
  private validateJson(field: CustomField, value: any, errors: string[]): void {
    if (typeof value === 'string') {
      try {
        JSON.parse(value);
      } catch {
        errors.push(`Field '${field.field_name}' must be valid JSON`);
      }
    } else if (typeof value !== 'object') {
      errors.push(`Field '${field.field_name}' must be a JSON object`);
    }
  }
  
  private applyCustomValidationRules(field: CustomField, value: any, errors: string[]): void {
    // Применение дополнительных правил валидации из field.validation_rules
    const rules = field.validation_rules as ValidationRule[];
    
    for (const rule of rules) {
      switch (rule.type) {
        case 'regex':
          if (typeof value === 'string' && rule.value && !new RegExp(rule.value).test(value)) {
            errors.push(rule.message || `Field '${field.field_name}' does not match required pattern`);
          }
          break;
        // Другие кастомные правила можно добавить здесь
      }
    }
  }
  
  private isValidFieldType(fieldType: string): boolean {
    const validTypes = [
      'text', 'textarea', 'number', 'date', 'datetime', 
      'email', 'url', 'select', 'multiselect', 'boolean', 'json'
    ];
    return validTypes.includes(fieldType);
  }
}