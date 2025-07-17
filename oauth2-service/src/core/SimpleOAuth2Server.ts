import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger } from '../utils/logger';
import { 
  OAuthClient, 
  OAuthUser, 
  OAuthToken, 
  AuthorizationCode 
} from '../types/oauth';

export class SimpleOAuth2Server {
  private clients: Map<string, OAuthClient> = new Map();
  private users: Map<string, OAuthUser> = new Map();
  private tokens: Map<string, OAuthToken> = new Map();
  private authCodes: Map<string, AuthorizationCode> = new Map();

  constructor() {
    // Initialize with demo clients
    this.initializeDemoClients();
  }

  private initializeDemoClients() {
    // Demo client for testing
    const demoClient: OAuthClient = {
      id: 'demo-client-id',
      secret: 'demo-client-secret',
      redirectUris: ['http://localhost:3000/auth/callback'],
      grants: ['authorization_code', 'refresh_token'],
      scopes: ['read', 'write'],
      tenantId: 'demo-tenant',
      name: 'Demo Client'
    };

    this.clients.set(demoClient.id, demoClient);
    logger.info('Demo OAuth2 client initialized', { clientId: demoClient.id });
  }

  // Authorization Code Flow
  async generateAuthorizationCode(
    clientId: string,
    userId: string,
    redirectUri: string,
    scopes: string[]
  ): Promise<string> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error('Invalid client');
    }

    if (!client.redirectUris.includes(redirectUri)) {
      throw new Error('Invalid redirect URI');
    }

    const code = uuidv4();
    const authCode: AuthorizationCode = {
      code,
      clientId,
      userId,
      redirectUri,
      scopes,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      createdAt: new Date()
    };

    this.authCodes.set(code, authCode);
    logger.debug('Authorization code generated', { code, clientId, userId });
    
    return code;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<OAuthToken> {
    const client = this.clients.get(clientId);
    if (!client || client.secret !== clientSecret) {
      throw new Error('Invalid client credentials');
    }

    const authCode = this.authCodes.get(code);
    if (!authCode) {
      throw new Error('Invalid authorization code');
    }

    if (authCode.expiresAt < new Date()) {
      this.authCodes.delete(code);
      throw new Error('Authorization code expired');
    }

    if (authCode.clientId !== clientId || authCode.redirectUri !== redirectUri) {
      throw new Error('Invalid authorization code');
    }

    // Generate access token
    const accessToken = this.generateAccessToken(authCode.userId, authCode.scopes, client.tenantId);
    const refreshToken = this.generateRefreshToken(authCode.userId, authCode.scopes, client.tenantId);

    const token: OAuthToken = {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 3600, // 1 hour
      scopes: authCode.scopes,
      userId: authCode.userId,
      clientId,
      tenantId: client.tenantId,
      createdAt: new Date()
    };

    this.tokens.set(accessToken, token);
    
    // Clean up authorization code
    this.authCodes.delete(code);
    
    logger.debug('Access token generated', { 
      accessToken: accessToken.substring(0, 20) + '...', 
      userId: authCode.userId,
      scopes: authCode.scopes
    });

    return token;
  }

  // Refresh token
  async refreshToken(refreshToken: string, clientId: string, clientSecret: string): Promise<OAuthToken> {
    const client = this.clients.get(clientId);
    if (!client || client.secret !== clientSecret) {
      throw new Error('Invalid client credentials');
    }

    // Find token by refresh token
    const existingToken = Array.from(this.tokens.values()).find(t => t.refreshToken === refreshToken);
    if (!existingToken) {
      throw new Error('Invalid refresh token');
    }

    // Generate new access token
    const accessToken = this.generateAccessToken(existingToken.userId, existingToken.scopes, existingToken.tenantId);
    const newRefreshToken = this.generateRefreshToken(existingToken.userId, existingToken.scopes, existingToken.tenantId);

    const token: OAuthToken = {
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
      scopes: existingToken.scopes,
      userId: existingToken.userId,
      clientId,
      tenantId: existingToken.tenantId,
      createdAt: new Date()
    };

    // Remove old token
    this.tokens.delete(existingToken.accessToken);
    
    // Store new token
    this.tokens.set(accessToken, token);

    logger.debug('Token refreshed', { 
      accessToken: accessToken.substring(0, 20) + '...', 
      userId: existingToken.userId 
    });

    return token;
  }

  // Client Credentials Flow
  async generateClientToken(clientId: string, clientSecret: string, scopes: string[]): Promise<OAuthToken> {
    const client = this.clients.get(clientId);
    if (!client || client.secret !== clientSecret) {
      throw new Error('Invalid client credentials');
    }

    if (!client.grants.includes('client_credentials')) {
      throw new Error('Client credentials grant not allowed');
    }

    const accessToken = this.generateAccessToken(clientId, scopes, client.tenantId);

    const token: OAuthToken = {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
      scopes,
      userId: clientId, // For client credentials, user is the client
      clientId,
      tenantId: client.tenantId,
      createdAt: new Date()
    };

    this.tokens.set(accessToken, token);
    
    logger.debug('Client credentials token generated', { 
      accessToken: accessToken.substring(0, 20) + '...', 
      clientId,
      scopes
    });

    return token;
  }

  // Token validation
  async validateToken(accessToken: string): Promise<OAuthToken | null> {
    const token = this.tokens.get(accessToken);
    if (!token) {
      return null;
    }

    // Check if token is expired
    const expiresAt = new Date(token.createdAt.getTime() + token.expiresIn * 1000);
    if (expiresAt < new Date()) {
      this.tokens.delete(accessToken);
      return null;
    }

    return token;
  }

  // Token revocation
  async revokeToken(token: string): Promise<void> {
    this.tokens.delete(token);
    logger.debug('Token revoked', { token: token.substring(0, 20) + '...' });
  }

  // Generate JWT access token
  private generateAccessToken(userId: string, scopes: string[], tenantId: string): string {
    const payload = {
      sub: userId,
      aud: 'multisaas-platform',
      iss: config.oauth2.issuer,
      scope: scopes.join(' '),
      tenant_id: tenantId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      jti: uuidv4()
    };

    return jwt.sign(payload, config.oauth2.jwtSecret, { algorithm: 'HS256' });
  }

  // Generate refresh token
  private generateRefreshToken(userId: string, scopes: string[], tenantId: string): string {
    const payload = {
      sub: userId,
      type: 'refresh',
      scope: scopes.join(' '),
      tenant_id: tenantId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
      jti: uuidv4()
    };

    return jwt.sign(payload, config.oauth2.jwtSecret, { algorithm: 'HS256' });
  }

  // Get user info from token
  async getUserInfo(accessToken: string): Promise<any> {
    const token = await this.validateToken(accessToken);
    if (!token) {
      throw new Error('Invalid token');
    }

    // Decode JWT to get user information
    const decoded = jwt.decode(accessToken) as any;
    
    return {
      sub: decoded.sub,
      name: decoded.name || 'Demo User',
      email: decoded.email || 'demo@example.com',
      picture: decoded.picture || 'https://via.placeholder.com/150',
      tenant_id: decoded.tenant_id
    };
  }

  // Client registration (simplified)
  async registerClient(client: Partial<OAuthClient>): Promise<OAuthClient> {
    const newClient: OAuthClient = {
      id: client.id || uuidv4(),
      secret: client.secret || uuidv4(),
      redirectUris: client.redirectUris || [],
      grants: client.grants || ['authorization_code', 'refresh_token'],
      scopes: client.scopes || ['read'],
      tenantId: client.tenantId || 'default',
      name: client.name || 'Unnamed Client'
    };

    this.clients.set(newClient.id, newClient);
    
    logger.info('OAuth2 client registered', { 
      clientId: newClient.id, 
      name: newClient.name,
      tenantId: newClient.tenantId
    });

    return newClient;
  }

  // Get client by ID
  async getClient(clientId: string): Promise<OAuthClient | null> {
    return this.clients.get(clientId) || null;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; clients: number; tokens: number }> {
    return {
      status: 'healthy',
      clients: this.clients.size,
      tokens: this.tokens.size
    };
  }
}