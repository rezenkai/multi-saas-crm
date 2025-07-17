import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        tenant_id: string;
      };
      tenant?: {
        id: string;
        name: string;
        status: string;
      };
    }
  }
}

export {};