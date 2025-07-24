import { registerAs } from '@nestjs/config';

export interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  callbackUrl: string;
  logoutUrl: string;
  managementApi: {
    clientId: string;
    clientSecret: string;
    audience: string;
  };
  connection?: string; // For enterprise connections
}

export default registerAs(
  'auth0',
  (): Auth0Config => ({
    domain: process.env.AUTH0_DOMAIN || '',
    clientId: process.env.AUTH0_CLIENT_ID || '',
    clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
    audience: process.env.AUTH0_AUDIENCE || '',
    callbackUrl:
      process.env.AUTH0_CALLBACK_URL ||
      'http://localhost:3002/api/v1/auth/auth0/callback',
    logoutUrl: process.env.AUTH0_LOGOUT_URL || 'http://localhost:3000',
    managementApi: {
      clientId:
        process.env.AUTH0_M2M_CLIENT_ID || process.env.AUTH0_CLIENT_ID || '',
      clientSecret:
        process.env.AUTH0_M2M_CLIENT_SECRET ||
        process.env.AUTH0_CLIENT_SECRET ||
        '',
      audience:
        process.env.AUTH0_M2M_AUDIENCE ||
        `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
    },
    connection: process.env.AUTH0_CONNECTION, // Optional: for enterprise connections
  }),
);
