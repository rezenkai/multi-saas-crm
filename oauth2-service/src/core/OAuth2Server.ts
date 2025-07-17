import OAuth2Server from 'oauth2-server';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  OAuthClient,
  OAuthUser,
  OAuthToken,
  AuthorizationCode,
  ClientModel,
  TokenModel,
  UserModel,
  AuthorizationCodeModel
} from '../types/oauth';

export class OAuth2Model {
  // Client methods
  async getClient(clientId: string, clientSecret?: string): Promise<ClientModel | null> {
    try {
      logger.debug('Getting OAuth client', { clientId });
      
      // In production, this would query the database
      // For now, return a mock client for testing
      const mockClient: ClientModel = {
        id: clientId,
        secret: clientSecret || 'test-secret',
        redirectUris: ['http://localhost:3000/auth/callback'],
        grants: ['authorization_code', 'refresh_token'],
        scopes: ['read', 'write'],
        tenantId: 'default',
        name: 'Test Client',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      // Validate client secret if provided
      if (clientSecret && mockClient.secret !== clientSecret) {
        logger.warn('Invalid client secret', { clientId });
        return null;
      }

      return mockClient;
    } catch (error) {
      logger.error('Error getting client', { error, clientId });
      return null;
    }
  }

  // User methods
  async getUser(email: string, password: string): Promise<UserModel | null> {
    try {
      logger.debug('Getting user for authentication', { email });
      
      // In production, this would validate against database
      // For now, return a mock user
      const mockUser: UserModel = {
        id: 'user-123',
        email: email,
        tenantId: 'default',
        profile: {
          name: 'Test User',
          avatar: 'https://via.placeholder.com/150'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return mockUser;
    } catch (error) {
      logger.error('Error getting user', { error, email });
      return null;
    }
  }

  async getUserFromClient(client: ClientModel): Promise<UserModel | null> {
    try {
      // For client credentials grant
      logger.debug('Getting user from client', { clientId: client.id });
      
      const serviceUser: UserModel = {
        id: `service-${client.id}`,
        email: `service@${client.tenantId}.local`,
        tenantId: client.tenantId,
        profile: {
          name: 'Service User',
          type: 'service'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return serviceUser;
    } catch (error) {
      logger.error('Error getting user from client', { error, clientId: client.id });
      return null;
    }
  }

  // Token methods
  async saveToken(token: any, client: ClientModel, user: UserModel): Promise<TokenModel> {
    try {
      logger.debug('Saving OAuth token', { 
        clientId: client.id, 
        userId: user.id,
        scopes: token.scope 
      });

      const tokenModel: TokenModel = {
        accessToken: token.accessToken,
        accessTokenExpiresAt: token.accessTokenExpiresAt,
        refreshToken: token.refreshToken,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        scope: Array.isArray(token.scope) ? token.scope : token.scope?.split(' ') || [],
        client: client,
        user: user,
        tenantId: user.tenantId
      };

      // In production, save to database
      logger.info('OAuth token saved', { 
        accessToken: token.accessToken.substring(0, 10) + '...', 
        userId: user.id,
        clientId: client.id 
      });

      return tokenModel;
    } catch (error) {
      logger.error('Error saving token', { error });
      throw error;
    }
  }

  async getAccessToken(accessToken: string): Promise<TokenModel | null> {
    try {
      logger.debug('Getting access token', { 
        accessToken: accessToken.substring(0, 10) + '...' 
      });

      // In production, query from database
      // For now, return null (tokens are not persisted in memory)
      return null;
    } catch (error) {
      logger.error('Error getting access token', { error });
      return null;
    }
  }

  async getRefreshToken(refreshToken: string): Promise<TokenModel | null> {
    try {
      logger.debug('Getting refresh token', { 
        refreshToken: refreshToken.substring(0, 10) + '...' 
      });

      // In production, query from database
      return null;
    } catch (error) {
      logger.error('Error getting refresh token', { error });
      return null;
    }
  }

  async revokeToken(token: TokenModel): Promise<boolean> {
    try {
      logger.debug('Revoking token', { 
        accessToken: token.accessToken.substring(0, 10) + '...',
        userId: token.user.id 
      });

      // In production, mark token as revoked in database
      logger.info('Token revoked', { userId: token.user.id });
      return true;
    } catch (error) {
      logger.error('Error revoking token', { error });
      return false;
    }
  }

  // Authorization Code methods
  async saveAuthorizationCode(code: any, client: ClientModel, user: UserModel): Promise<AuthorizationCodeModel> {
    try {
      logger.debug('Saving authorization code', { 
        clientId: client.id, 
        userId: user.id 
      });

      const authCode: AuthorizationCodeModel = {
        code: code.authorizationCode,
        expiresAt: code.expiresAt,
        redirectUri: code.redirectUri,
        scope: Array.isArray(code.scope) ? code.scope : code.scope?.split(' ') || [],
        client: client,
        user: user,
        tenantId: user.tenantId,
        codeChallenge: code.codeChallenge,
        codeChallengeMethod: code.codeChallengeMethod
      };

      // In production, save to database
      logger.info('Authorization code saved', { 
        code: code.authorizationCode.substring(0, 10) + '...',
        userId: user.id 
      });

      return authCode;
    } catch (error) {
      logger.error('Error saving authorization code', { error });
      throw error;
    }
  }

  async getAuthorizationCode(authorizationCode: string): Promise<AuthorizationCodeModel | null> {
    try {
      logger.debug('Getting authorization code', { 
        code: authorizationCode.substring(0, 10) + '...' 
      });

      // In production, query from database
      return null;
    } catch (error) {
      logger.error('Error getting authorization code', { error });
      return null;
    }
  }

  async revokeAuthorizationCode(code: AuthorizationCodeModel): Promise<boolean> {
    try {
      logger.debug('Revoking authorization code', { 
        code: code.code.substring(0, 10) + '...' 
      });

      // In production, mark code as used in database
      logger.info('Authorization code revoked');
      return true;
    } catch (error) {
      logger.error('Error revoking authorization code', { error });
      return false;
    }
  }

  // Scope validation
  async verifyScope(user: UserModel, client: ClientModel, scope: string[]): Promise<boolean> {
    try {
      logger.debug('Verifying scope', { 
        userId: user.id, 
        clientId: client.id, 
        requestedScope: scope 
      });

      // Check if requested scopes are allowed for this client
      const allowedScopes = client.scopes;
      const isValidScope = scope.every(s => allowedScopes.includes(s));

      if (!isValidScope) {
        logger.warn('Invalid scope requested', { 
          requestedScope: scope, 
          allowedScopes 
        });
        return false;
      }

      logger.debug('Scope verified successfully', { scope });
      return true;
    } catch (error) {
      logger.error('Error verifying scope', { error });
      return false;
    }
  }
}

export class OAuth2ServerManager {
  private server: OAuth2Server;
  private model: OAuth2Model;

  constructor() {
    this.model = new OAuth2Model();
    
    this.server = new OAuth2Server({
      model: this.model,
      grants: config.oauth2.allowedGrantTypes,
      accessTokenLifetime: config.oauth2.accessTokenLifetime,
      refreshTokenLifetime: config.oauth2.refreshTokenLifetime,
      authorizationCodeLifetime: config.oauth2.authorizationCodeLifetime,
      allowBearerTokensInQueryString: false,
      allowEmptyState: false,
      requireClientAuthentication: {
        authorization_code: true,
        refresh_token: true,
        client_credentials: true
      }
    });

    logger.info('OAuth2 Server initialized', {
      grants: config.oauth2.allowedGrantTypes,
      accessTokenLifetime: config.oauth2.accessTokenLifetime,
      refreshTokenLifetime: config.oauth2.refreshTokenLifetime
    });
  }

  getServer(): OAuth2Server {
    return this.server;
  }

  getModel(): OAuth2Model {
    return this.model;
  }

  // Helper method to validate PKCE
  validatePKCE(codeVerifier: string, codeChallenge: string, method: string = 'S256'): boolean {
    try {
      if (method === 'plain') {
        return codeVerifier === codeChallenge;
      }
      
      if (method === 'S256') {
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        return hash === codeChallenge;
      }

      return false;
    } catch (error) {
      logger.error('PKCE validation error', { error });
      return false;
    }
  }

  // Generate authorization URL
  generateAuthorizationUrl(params: {
    clientId: string;
    redirectUri: string;
    scope?: string;
    state?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
  }): string {
    const url = new URL('/oauth/authorize', config.oauth2.issuer);
    
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', params.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    
    if (params.scope) {
      url.searchParams.set('scope', params.scope);
    }
    
    if (params.state) {
      url.searchParams.set('state', params.state);
    }
    
    if (params.codeChallenge) {
      url.searchParams.set('code_challenge', params.codeChallenge);
      url.searchParams.set('code_challenge_method', params.codeChallengeMethod || 'S256');
    }

    return url.toString();
  }
}