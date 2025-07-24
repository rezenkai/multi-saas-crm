import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/types';
import { Auth0Service } from './auth0.service';

@Controller('auth/auth0')
export class Auth0Controller {
  constructor(private readonly auth0Service: Auth0Service) {}

  /**
   * Initiate Auth0 SSO login
   * GET /api/v1/auth/auth0/login
   */
  @Public()
  @Get('login')
  async login(
    @Query('connection') connection?: string,
    @Query('tenant_id') tenantId?: string,
    @Query('return_to') returnTo?: string,
    @Res() res?: Response,
  ) {
    try {
      if (!this.auth0Service.isAuth0Configured()) {
        return res?.status(400).json({
          success: false,
          error: 'Auth0 SSO is not configured',
          message: 'Please contact your administrator to enable SSO',
        });
      }

      // Create state parameter with tenant and return URL info
      const state = JSON.stringify({
        tenantId: tenantId || 'default-tenant',
        returnTo:
          returnTo || process.env.FRONTEND_URL || 'http://localhost:3000',
        timestamp: Date.now(),
      });

      const authUrl = this.auth0Service.getAuthorizationUrl(
        Buffer.from(state).toString('base64'),
        connection,
      );

      if (res) {
        // Redirect to Auth0 for browser requests
        return res.redirect(authUrl);
      } else {
        // Return URL for API requests
        return {
          success: true,
          data: {
            authUrl,
            message: 'Redirect to this URL to continue with Auth0 SSO',
          },
        };
      }
    } catch (error) {
      if (res) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Handle Auth0 callback after successful authentication
   * GET /api/v1/auth/auth0/callback
   */
  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
    @Res() res?: Response,
  ) {
    try {
      // Handle Auth0 errors
      if (error) {
        const errorMsg = errorDescription || error;
        console.error('Auth0 callback error:', errorMsg);

        if (res) {
          const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?error=${encodeURIComponent(errorMsg)}`;
          return res.redirect(errorUrl);
        }

        throw new UnauthorizedException(
          `Auth0 authentication failed: ${errorMsg}`,
        );
      }

      if (!code) {
        throw new BadRequestException('Authorization code is required');
      }

      // Parse state parameter
      let stateData: any = {};
      if (state) {
        try {
          const decoded = Buffer.from(state, 'base64').toString();
          stateData = JSON.parse(decoded);
        } catch (err) {
          console.warn('Failed to parse state parameter:', err);
        }
      }

      // Step 1: Exchange code for tokens
      const tokens = await this.auth0Service.exchangeCodeForTokens(code);

      // Step 2: Get user info from Auth0
      const auth0User = await this.auth0Service.getUserInfo(tokens.accessToken);

      // Step 3: Create or update user in our database
      const { user, isNewUser } = await this.auth0Service.syncUserFromAuth0(
        auth0User,
        stateData.tenantId,
      );

      // Step 4: Generate our own JWT tokens
      const ourTokens = await this.auth0Service.generateTokensForAuth0User(
        user,
        stateData.tenantId || 'default-tenant',
      );

      console.log(
        `Auth0 SSO successful for ${user.email} (${isNewUser ? 'new' : 'existing'} user)`,
      );

      if (res) {
        // For browser requests, redirect to frontend with tokens
        const returnUrl =
          stateData.returnTo ||
          process.env.FRONTEND_URL ||
          'http://localhost:3000';
        const successUrl =
          `${returnUrl}/auth/success?` +
          new URLSearchParams({
            access_token: ourTokens.accessToken,
            refresh_token: ourTokens.refreshToken,
            token_type: ourTokens.tokenType,
            expires_in: ourTokens.expiresIn.toString(),
            user_email: user.email,
            is_new_user: isNewUser.toString(),
          }).toString();

        return res.redirect(successUrl);
      } else {
        // For API requests, return tokens directly
        return {
          success: true,
          data: {
            ...ourTokens,
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
              avatarUrl: user.avatarUrl,
              isNewUser,
            },
            auth0User: {
              user_id: auth0User.user_id,
              email: auth0User.email,
              name: auth0User.name,
              picture: auth0User.picture,
            },
          },
          message: `SSO authentication successful${isNewUser ? ' - new user created' : ''}`,
        };
      }
    } catch (error) {
      console.error('Auth0 callback error:', error);

      if (res) {
        const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?error=${encodeURIComponent(error.message)}`;
        return res.redirect(errorUrl);
      }

      throw new UnauthorizedException(error.message);
    }
  }

  /**
   * Get Auth0 logout URL
   * GET /api/v1/auth/auth0/logout
   */
  @Public()
  @Get('logout')
  getLogoutUrl(@Query('return_to') returnTo?: string) {
    try {
      const logoutUrl = this.auth0Service.getLogoutUrl(returnTo);

      return {
        success: true,
        data: {
          logoutUrl,
          message: 'Redirect to this URL to logout from Auth0',
        },
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Logout from Auth0 (redirect endpoint)
   * POST /api/v1/auth/auth0/logout
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: { return_to?: string }, @Res() res?: Response) {
    try {
      const logoutUrl = this.auth0Service.getLogoutUrl(body.return_to);

      if (res) {
        return res.redirect(logoutUrl);
      }

      return {
        success: true,
        data: { logoutUrl },
        message: 'Logout initiated',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get Auth0 connection status
   * GET /api/v1/auth/auth0/status
   */
  @Public()
  @Get('status')
  getStatus() {
    const isConfigured = this.auth0Service.isAuth0Configured();

    return {
      success: true,
      data: {
        configured: isConfigured,
        domain: isConfigured ? process.env.AUTH0_DOMAIN : null,
        features: {
          sso: isConfigured,
          enterpriseConnections: isConfigured,
          socialLogins: isConfigured,
          mfa: isConfigured,
        },
        message: isConfigured
          ? 'Auth0 SSO is configured and ready'
          : 'Auth0 SSO is not configured',
      },
    };
  }

  /**
   * Sync current user with Auth0 (for existing users)
   * POST /api/v1/auth/auth0/sync
   */
  @UseGuards(JwtAuthGuard)
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncUser(@Req() req: Request) {
    const authUser: AuthUser = (req as any).user;

    try {
      if (!authUser.email) {
        throw new BadRequestException('User email is required for Auth0 sync');
      }

      // Create Auth0 user for existing user
      const auth0User = await this.auth0Service.createAuth0User({
        email: authUser.email,
        given_name: authUser.firstName,
        family_name: authUser.lastName,
        name: `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim(),
      });

      return {
        success: true,
        data: {
          auth0UserId: auth0User.user_id,
          message: 'User successfully synced with Auth0',
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to sync user with Auth0: ${error.message}`,
      );
    }
  }
}
