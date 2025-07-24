import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ManagementClient } from 'auth0';
import axios from 'axios';
import { JwtService } from '../auth/jwt.service';
import { Auth0Config } from '../config/auth0.config';
import { CreateUserDto, UpdateUserDto } from '../user/dto';
import { UserService } from '../user/user.service';

export interface Auth0User {
  user_id: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  login_count?: number;
  identities?: Array<{
    provider: string;
    user_id: string;
    connection: string;
    isSocial: boolean;
  }>;
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
}

export interface Auth0LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: Auth0User;
}

// Extended DTOs to handle Auth0-specific fields
interface CreateUserWithAuth0Dto extends Omit<CreateUserDto, 'password'> {
  password?: string; // Make password optional for Auth0 users
  auth0Id?: string;
  isActive?: boolean;
  isVerified?: boolean;
  lastLogin?: Date;
}

interface UpdateUserWithAuth0Dto extends UpdateUserDto {
  auth0Id?: string;
  isVerified?: boolean;
  lastLogin?: Date;
}

@Injectable()
export class Auth0Service {
  private readonly logger = new Logger(Auth0Service.name);
  private readonly auth0Config: Auth0Config;
  private managementApi: ManagementClient;
  private managementToken: string;
  private tokenExpiresAt: number = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {
    this.auth0Config = this.configService.get<Auth0Config>('auth0')!;

    if (this.isAuth0Configured()) {
      this.initializeManagementApi();
    } else {
      this.logger.warn('Auth0 not configured - SSO features will be disabled');
    }
  }

  /**
   * Check if Auth0 is properly configured
   */
  isAuth0Configured(): boolean {
    return !!(
      this.auth0Config.domain &&
      this.auth0Config.clientId &&
      this.auth0Config.clientSecret
    );
  }

  /**
   * Initialize Auth0 Management API
   */
  private async initializeManagementApi(): Promise<void> {
    try {
      // Get Management API token
      await this.getManagementToken();

      this.managementApi = new ManagementClient({
        domain: this.auth0Config.domain,
        token: this.managementToken,
      });

      this.logger.log('Auth0 Management API initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Auth0 Management API:', error);
    }
  }

  /**
   * Get Auth0 Management API token
   */
  private async getManagementToken(): Promise<string> {
    // Check if current token is still valid (with 5-minute buffer)
    if (this.managementToken && Date.now() < this.tokenExpiresAt - 300000) {
      return this.managementToken;
    }

    try {
      const response = await axios.post(
        `https://${this.auth0Config.domain}/oauth/token`,
        {
          client_id: this.auth0Config.managementApi.clientId,
          client_secret: this.auth0Config.managementApi.clientSecret,
          audience: this.auth0Config.managementApi.audience,
          grant_type: 'client_credentials',
        },
      );

      this.managementToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;

      this.logger.log('Auth0 Management API token refreshed');
      return this.managementToken;
    } catch (error) {
      this.logger.error('Failed to get Auth0 Management API token:', error);
      throw new Error('Failed to authenticate with Auth0 Management API');
    }
  }

  /**
   * Generate Auth0 authorization URL for SSO login
   */
  getAuthorizationUrl(state?: string, connection?: string): string {
    if (!this.isAuth0Configured()) {
      throw new BadRequestException('Auth0 not configured');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.auth0Config.clientId,
      redirect_uri: this.auth0Config.callbackUrl,
      scope: 'openid profile email',
      audience: this.auth0Config.audience,
    });

    if (state) {
      params.append('state', state);
    }

    if (connection || this.auth0Config.connection) {
      params.append('connection', connection || this.auth0Config.connection!);
    }

    const authUrl = `https://${this.auth0Config.domain}/authorize?${params.toString()}`;

    this.logger.log(
      `Generated Auth0 authorization URL for connection: ${connection || 'default'}`,
    );
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    redirectUri?: string,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    idToken: string;
    expiresIn: number;
  }> {
    if (!this.isAuth0Configured()) {
      throw new BadRequestException('Auth0 not configured');
    }

    try {
      const response = await axios.post(
        `https://${this.auth0Config.domain}/oauth/token`,
        {
          grant_type: 'authorization_code',
          client_id: this.auth0Config.clientId,
          client_secret: this.auth0Config.clientSecret,
          code,
          redirect_uri: redirectUri || this.auth0Config.callbackUrl,
        },
      );

      this.logger.log('Successfully exchanged Auth0 code for tokens');

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        idToken: response.data.id_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      this.logger.error(
        'Failed to exchange Auth0 code for tokens:',
        error.response?.data || error.message,
      );
      throw new UnauthorizedException('Failed to authenticate with Auth0');
    }
  }

  /**
   * Get user info from Auth0 access token
   */
  async getUserInfo(accessToken: string): Promise<Auth0User> {
    if (!this.isAuth0Configured()) {
      throw new BadRequestException('Auth0 not configured');
    }

    try {
      const response = await axios.get(
        `https://${this.auth0Config.domain}/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      this.logger.log(`Retrieved Auth0 user info for: ${response.data.email}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        'Failed to get Auth0 user info:',
        error.response?.data || error.message,
      );
      throw new UnauthorizedException(
        'Failed to get user information from Auth0',
      );
    }
  }

  /**
   * Create or update user from Auth0 profile
   */
  async syncUserFromAuth0(
    auth0User: Auth0User,
    tenantId?: string,
  ): Promise<{
    user: any;
    isNewUser: boolean;
  }> {
    try {
      // Try to find existing user by Auth0 ID or email
      let existingUser: any = null; // Fix: Explicitly type as any

      if (auth0User.user_id) {
        existingUser = await this.userService.findByAuth0Id(auth0User.user_id);
      }

      if (!existingUser && auth0User.email) {
        existingUser = await this.userService.findByEmail(auth0User.email);
      }

      if (existingUser) {
        // Update existing user with Auth0 data using the sync method
        const updatedUser = await this.userService.syncFromAuth0(
          existingUser.id,
          {
            email: auth0User.email,
            firstName: auth0User.given_name || existingUser.firstName,
            lastName: auth0User.family_name || existingUser.lastName,
            avatarUrl: auth0User.picture || existingUser.avatarUrl,
            isVerified: auth0User.email_verified,
          },
        );

        // Update Auth0 ID if it wasn't set before
        if (!existingUser.auth0Id && auth0User.user_id) {
          await this.userService.updateAuth0Id(
            existingUser.id,
            auth0User.user_id,
          );
        }

        this.logger.log(`Updated existing user from Auth0: ${auth0User.email}`);
        return { user: updatedUser, isNewUser: false };
      } else {
        // Create new Auth0 user using the dedicated method
        const newUser = await this.userService.createAuth0User({
          email: auth0User.email,
          firstName: auth0User.given_name,
          lastName: auth0User.family_name,
          username: auth0User.email,
          auth0Id: auth0User.user_id,
          isVerified: auth0User.email_verified,
        });

        this.logger.log(`Created new user from Auth0: ${auth0User.email}`);
        return { user: newUser, isNewUser: true };
      }
    } catch (error) {
      this.logger.error('Failed to sync user from Auth0:', error);
      throw new BadRequestException(
        'Failed to create or update user from Auth0 profile',
      );
    }
  }

  /**
   * Generate our JWT tokens for Auth0 user
   */
  async generateTokensForAuth0User(
    user: any,
    tenantId: string = 'default-tenant',
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
  }> {
    const role = user.isSuperuser ? 'admin' : 'user';
    const tokenPair = this.jwtService.generateTokenPair(user, tenantId, role);

    this.logger.log(`Generated JWT tokens for Auth0 user: ${user.email}`);

    return tokenPair;
  }

  /**
   * Get Auth0 logout URL
   */
  getLogoutUrl(returnTo?: string): string {
    if (!this.isAuth0Configured()) {
      throw new BadRequestException('Auth0 not configured');
    }

    const params = new URLSearchParams({
      client_id: this.auth0Config.clientId,
      returnTo: returnTo || this.auth0Config.logoutUrl,
    });

    return `https://${this.auth0Config.domain}/v2/logout?${params.toString()}`;
  }

  /**
   * Create Auth0 user (for user migration)
   */
  async createAuth0User(userData: {
    email: string;
    password?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    connection?: string;
  }): Promise<any> {
    // Fix: Change return type to any
    if (!this.isAuth0Configured()) {
      throw new BadRequestException('Auth0 not configured');
    }

    try {
      await this.ensureManagementToken();

      // Fix: Use correct method name from ManagementClient
      const auth0User = await this.managementApi.users.create({
        connection: userData.connection || 'Username-Password-Authentication',
        email: userData.email,
        password: userData.password,
        name: userData.name,
        given_name: userData.given_name,
        family_name: userData.family_name,
        email_verified: false,
      });

      this.logger.log(`Created Auth0 user: ${userData.email}`);
      return auth0User.data; // Fix: Return the data property
    } catch (error) {
      this.logger.error('Failed to create Auth0 user:', error);
      throw new BadRequestException('Failed to create user in Auth0');
    }
  }

  /**
   * Get Auth0 user by ID
   */
  async getAuth0User(userId: string): Promise<any> {
    // Fix: Change return type to any
    if (!this.isAuth0Configured()) {
      throw new BadRequestException('Auth0 not configured');
    }

    try {
      await this.ensureManagementToken();

      // Fix: Use correct method name from ManagementClient
      const user = await this.managementApi.users.get({ id: userId });

      this.logger.log(`Retrieved Auth0 user: ${userId}`);
      return user.data; // Fix: Return the data property
    } catch (error) {
      this.logger.error('Failed to get Auth0 user:', error);
      throw new BadRequestException('Failed to get user from Auth0');
    }
  }

  /**
   * Ensure we have a valid management token
   */
  private async ensureManagementToken(): Promise<void> {
    if (!this.managementToken || Date.now() >= this.tokenExpiresAt - 300000) {
      await this.getManagementToken();

      this.managementApi = new ManagementClient({
        domain: this.auth0Config.domain,
        token: this.managementToken,
      });
    }
  }
}
