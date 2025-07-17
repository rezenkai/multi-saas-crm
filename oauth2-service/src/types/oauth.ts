// OAuth2 Types and Interfaces

export interface OAuthClient {
  id: string;
  secret: string;
  redirectUris: string[];
  grants: string[];
  scopes: string[];
  tenantId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface OAuthUser {
  id: string;
  email: string;
  tenantId: string;
  profile: {
    name?: string;
    avatar?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthToken {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
  scope: string[];
  client: OAuthClient;
  user: OAuthUser;
  tenantId: string;
}

export interface AuthorizationCode {
  code: string;
  expiresAt: Date;
  redirectUri: string;
  scope: string[];
  client: OAuthClient;
  user: OAuthUser;
  tenantId: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
}

export interface ExternalProvider {
  id: string;
  name: string;
  type: 'google' | 'microsoft' | 'github' | 'slack';
  config: {
    clientId: string;
    clientSecret: string;
    scopes: string[];
    callbackUrl: string;
  };
  tenantId: string;
  isActive: boolean;
}

export interface ExternalToken {
  id: string;
  userId: string;
  tenantId: string;
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
  providerUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenRequest {
  grant_type: string;
  client_id: string;
  client_secret?: string;
  code?: string;
  redirect_uri?: string;
  refresh_token?: string;
  scope?: string;
  code_verifier?: string; // PKCE
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface AuthorizeRequest {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  code_challenge?: string; // PKCE
  code_challenge_method?: 'S256' | 'plain'; // PKCE
}

export interface UserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  tenant_id: string;
  [key: string]: any;
}

export interface ExternalUserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  provider: string;
  raw: any;
}

// Database Models
export interface ClientModel extends OAuthClient {
  // Additional methods for oauth2-server compatibility
  checkClientSecret?(secret: string): boolean;
  getRedirectUri?(): string;
}

export interface TokenModel extends OAuthToken {
  // Additional methods for oauth2-server compatibility
}

export interface UserModel extends OAuthUser {
  // Additional methods for oauth2-server compatibility
  verifyPassword?(password: string): boolean;
}

export interface AuthorizationCodeModel extends AuthorizationCode {
  // Additional methods for oauth2-server compatibility
}

// Service Interfaces
export interface OAuthService {
  createClient(tenantId: string, clientData: Partial<OAuthClient>): Promise<OAuthClient>;
  getClient(clientId: string): Promise<OAuthClient | null>;
  updateClient(clientId: string, updates: Partial<OAuthClient>): Promise<OAuthClient | null>;
  deleteClient(clientId: string): Promise<boolean>;
  
  createToken(tokenData: Partial<OAuthToken>): Promise<OAuthToken>;
  getToken(accessToken: string): Promise<OAuthToken | null>;
  revokeToken(accessToken: string): Promise<boolean>;
  
  createAuthorizationCode(codeData: Partial<AuthorizationCode>): Promise<AuthorizationCode>;
  getAuthorizationCode(code: string): Promise<AuthorizationCode | null>;
  revokeAuthorizationCode(code: string): Promise<boolean>;
}

export interface ExternalProviderService {
  getProviderConfig(tenantId: string, provider: string): Promise<ExternalProvider | null>;
  createExternalToken(tokenData: Partial<ExternalToken>): Promise<ExternalToken>;
  getExternalToken(userId: string, provider: string): Promise<ExternalToken | null>;
  refreshExternalToken(tokenId: string): Promise<ExternalToken | null>;
  revokeExternalToken(tokenId: string): Promise<boolean>;
}

// Request/Response Types
export interface OAuth2Request extends Express.Request {
  user?: OAuthUser;
  tenant?: {
    id: string;
    name: string;
  };
  client?: OAuthClient;
}

export interface OAuth2Response extends Express.Response {
  // Extended response type
}

// Error Types
export interface OAuth2Error extends Error {
  status?: number;
  code?: string;
  description?: string;
}

export class InvalidClientError extends Error implements OAuth2Error {
  status = 401;
  code = 'invalid_client';
  
  constructor(message = 'Invalid client credentials') {
    super(message);
    this.name = 'InvalidClientError';
  }
}

export class InvalidGrantError extends Error implements OAuth2Error {
  status = 400;
  code = 'invalid_grant';
  
  constructor(message = 'Invalid grant') {
    super(message);
    this.name = 'InvalidGrantError';
  }
}

export class InvalidRequestError extends Error implements OAuth2Error {
  status = 400;
  code = 'invalid_request';
  
  constructor(message = 'Invalid request') {
    super(message);
    this.name = 'InvalidRequestError';
  }
}

export class UnsupportedGrantTypeError extends Error implements OAuth2Error {
  status = 400;
  code = 'unsupported_grant_type';
  
  constructor(message = 'Unsupported grant type') {
    super(message);
    this.name = 'UnsupportedGrantTypeError';
  }
}