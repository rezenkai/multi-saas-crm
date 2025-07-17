import { API_CONFIG, getApiUrl, getAuthHeaders } from '../config/api';

// API Request wrapper
export class ApiClient {
  static async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = getApiUrl(endpoint);
    const headers = getAuthHeaders();
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    };
    
    try {
      const response = await fetch(url, config);
      return response;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }
  
  static async get(endpoint: string): Promise<Response> {
    return this.request(endpoint, { method: 'GET' });
  }
  
  static async post(endpoint: string, data: any): Promise<Response> {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  static async put(endpoint: string, data: any): Promise<Response> {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  
  static async delete(endpoint: string): Promise<Response> {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

// Legacy support - gradually replace direct fetch calls with this
export const apiRequest = (endpoint: string, options: RequestInit = {}) => {
  return ApiClient.request(endpoint, options);
};