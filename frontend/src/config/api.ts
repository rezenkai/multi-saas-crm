// API Configuration for Multi-SaaS Platform
export const API_CONFIG = {
  // Use API Gateway as the main entry point
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  
  // API Endpoints
  ENDPOINTS: {
    // Authentication endpoints
    AUTH: {
      LOGIN: '/api/v1/auth/login',
      REGISTER: '/api/v1/auth/register',
      FORGOT_PASSWORD: '/api/v1/auth/forgot-password',
      RESET_PASSWORD: '/api/v1/auth/reset-password',
      VERIFY_EMAIL: '/api/v1/auth/verify-email',
      CHANGE_PASSWORD: '/api/v1/auth/change-password',
      ME: '/api/v1/auth/me',
    },
    
    // CRM endpoints
    CONTACTS: '/api/v1/contacts',
    COMPANIES: '/api/v1/companies',
    OPPORTUNITIES: '/api/v1/opportunities',
    DASHBOARD: '/api/v1/dashboard',
    USERS: '/api/v1/users',
    
    // New microservices endpoints
    PLUGINS: '/api/plugins',
    ERP: '/api/erp',
    MARKETING: '/api/marketing',
  },
  
  // Request configuration
  TIMEOUT: 30000,
  HEADERS: {
    'Content-Type': 'application/json',
  }
};

// Helper function to get full URL
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function to get auth headers
export const getAuthHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    ...API_CONFIG.HEADERS,
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};