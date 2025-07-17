import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ExternalUserProfile } from '../types/oauth';

const router = express.Router();

// Configure passport strategies
function configurePassportStrategies() {
  // Google OAuth2 Strategy
  if (config.providers.google.clientId && config.providers.google.clientSecret) {
    passport.use('google', new GoogleStrategy({
      clientID: config.providers.google.clientId,
      clientSecret: config.providers.google.clientSecret,
      callbackURL: config.providers.google.callbackUrl,
      scope: config.providers.google.scopes
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        logger.info('Google OAuth callback', { userId: profile.id, email: profile.emails?.[0]?.value });

        const userProfile: ExternalUserProfile = {
          id: profile.id,
          email: profile.emails?.[0]?.value || '',
          name: profile.displayName,
          avatar: profile.photos?.[0]?.value,
          provider: 'google',
          raw: {
            profile,
            accessToken,
            refreshToken
          }
        };

        return done(null, userProfile);
      } catch (error) {
        logger.error('Google OAuth error', { error });
        return done(error, null);
      }
    }));
  }

  // GitHub OAuth2 Strategy
  if (config.providers.github.clientId && config.providers.github.clientSecret) {
    passport.use('github', new GitHubStrategy({
      clientID: config.providers.github.clientId,
      clientSecret: config.providers.github.clientSecret,
      callbackURL: config.providers.github.callbackUrl,
      scope: config.providers.github.scopes
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        logger.info('GitHub OAuth callback', { userId: profile.id, username: profile.username });

        const userProfile: ExternalUserProfile = {
          id: profile.id,
          email: profile.emails?.[0]?.value || '',
          name: profile.displayName || profile.username,
          avatar: profile.photos?.[0]?.value,
          provider: 'github',
          raw: {
            profile,
            accessToken,
            refreshToken
          }
        };

        return done(null, userProfile);
      } catch (error) {
        logger.error('GitHub OAuth error', { error });
        return done(error, null);
      }
    }));
  }

  // Microsoft OAuth2 Strategy (placeholder - would need proper implementation)
  // Note: passport-microsoft might not be the latest, consider using passport-azure-ad
}

// Initialize passport strategies
configurePassportStrategies();

// Google OAuth routes
router.get('/google', (req, res, next) => {
  const { state, tenant_id } = req.query;
  
  // Store state and tenant info in session for callback
  if (req.session) {
    req.session.oauth_state = state;
    req.session.tenant_id = tenant_id;
  }

  passport.authenticate('google', {
    scope: config.providers.google.scopes,
    state: state as string
  })(req, res, next);
});

router.get('/google/callback', 
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    try {
      const userProfile = req.user as ExternalUserProfile;
      const state = req.session?.oauth_state;
      const tenantId = req.session?.tenant_id || 'default';

      logger.info('Google OAuth successful', { 
        userId: userProfile.id, 
        email: userProfile.email,
        tenantId 
      });

      // In production, you would:
      // 1. Check if user exists in your system
      // 2. Create or update user record
      // 3. Store external tokens securely
      // 4. Generate your own OAuth2 authorization code
      // 5. Redirect back to client application

      // For demo, redirect with success
      const redirectUrl = new URL('http://localhost:3000/auth/callback');
      redirectUrl.searchParams.set('provider', 'google');
      redirectUrl.searchParams.set('success', 'true');
      redirectUrl.searchParams.set('email', userProfile.email);
      if (state) redirectUrl.searchParams.set('state', state);

      res.redirect(redirectUrl.toString());

    } catch (error) {
      logger.error('Google OAuth callback error', { error });
      res.redirect('http://localhost:3000/auth/error?provider=google');
    }
  }
);

// GitHub OAuth routes
router.get('/github', (req, res, next) => {
  const { state, tenant_id } = req.query;
  
  if (req.session) {
    req.session.oauth_state = state;
    req.session.tenant_id = tenant_id;
  }

  passport.authenticate('github', {
    scope: config.providers.github.scopes,
    state: state as string
  })(req, res, next);
});

router.get('/github/callback',
  passport.authenticate('github', { session: false }),
  async (req, res) => {
    try {
      const userProfile = req.user as ExternalUserProfile;
      const state = req.session?.oauth_state;
      const tenantId = req.session?.tenant_id || 'default';

      logger.info('GitHub OAuth successful', { 
        userId: userProfile.id, 
        username: userProfile.name,
        tenantId 
      });

      const redirectUrl = new URL('http://localhost:3000/auth/callback');
      redirectUrl.searchParams.set('provider', 'github');
      redirectUrl.searchParams.set('success', 'true');
      redirectUrl.searchParams.set('username', userProfile.name || '');
      if (state) redirectUrl.searchParams.set('state', state);

      res.redirect(redirectUrl.toString());

    } catch (error) {
      logger.error('GitHub OAuth callback error', { error });
      res.redirect('http://localhost:3000/auth/error?provider=github');
    }
  }
);

// Microsoft OAuth routes (placeholder)
router.get('/microsoft', (req, res) => {
  res.status(501).json({
    error: 'not_implemented',
    message: 'Microsoft OAuth integration coming soon'
  });
});

router.get('/microsoft/callback', (req, res) => {
  res.status(501).json({
    error: 'not_implemented', 
    message: 'Microsoft OAuth integration coming soon'
  });
});

// Slack OAuth routes (placeholder)
router.get('/slack', (req, res) => {
  res.status(501).json({
    error: 'not_implemented',
    message: 'Slack OAuth integration coming soon'
  });
});

router.get('/slack/callback', (req, res) => {
  res.status(501).json({
    error: 'not_implemented',
    message: 'Slack OAuth integration coming soon'
  });
});

// Get available providers
router.get('/providers', (req, res) => {
  const availableProviders = [];

  if (config.providers.google.clientId) {
    availableProviders.push({
      name: 'google',
      displayName: 'Google',
      authUrl: '/auth/google',
      scopes: config.providers.google.scopes
    });
  }

  if (config.providers.github.clientId) {
    availableProviders.push({
      name: 'github',
      displayName: 'GitHub', 
      authUrl: '/auth/github',
      scopes: config.providers.github.scopes
    });
  }

  res.json({
    providers: availableProviders,
    configured: availableProviders.length
  });
});

export default router;