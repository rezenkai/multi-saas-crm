import express from 'express';
import { SimpleOAuth2Server } from '../core/SimpleOAuth2Server';
import { logger } from '../utils/logger';
import { config } from '../config';

const router = express.Router();
const oauth2Server = new SimpleOAuth2Server();

// OAuth2 Authorization endpoint
// GET /oauth/authorize?response_type=code&client_id=...&redirect_uri=...&scope=...&state=...
router.get('/authorize', async (req, res) => {
  try {
    logger.info('Authorization request received', { 
      query: req.query,
      ip: req.ip 
    });

    const { 
      response_type, 
      client_id, 
      redirect_uri, 
      scope, 
      state
    } = req.query;

    // Basic validation
    if (response_type !== 'code') {
      return res.status(400).json({
        error: 'unsupported_response_type',
        error_description: 'Only authorization code flow is supported'
      });
    }

    if (!client_id || !redirect_uri) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters: client_id, redirect_uri'
      });
    }

    // Validate client
    const client = await oauth2Server.getClient(client_id as string);
    if (!client) {
      return res.status(400).json({
        error: 'invalid_client',
        error_description: 'Invalid client_id'
      });
    }

    // Validate redirect URI
    if (!client.redirectUris.includes(redirect_uri as string)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid redirect_uri'
      });
    }

    // Render simple consent page
    const consentPageHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>OAuth2 Authorization</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }
            .auth-form { border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
            .client-info { background: #f5f5f5; padding: 10px; margin-bottom: 20px; border-radius: 4px; }
            button { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; }
            .approve { background: #4CAF50; color: white; }
            .deny { background: #f44336; color: white; }
            input { width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px; }
        </style>
    </head>
    <body>
        <div class="auth-form">
            <h2>OAuth2 Authorization</h2>
            <div class="client-info">
                <strong>Application:</strong> ${client.name}<br>
                <strong>Scopes:</strong> ${scope || 'default'}<br>
                <strong>Redirect URI:</strong> ${redirect_uri}
            </div>
            
            <form action="/oauth/authorize" method="post">
                <input type="hidden" name="client_id" value="${client_id}">
                <input type="hidden" name="redirect_uri" value="${redirect_uri}">
                <input type="hidden" name="scope" value="${scope || 'read'}">
                <input type="hidden" name="state" value="${state || ''}">
                
                <h3>Demo Login</h3>
                <input type="email" name="email" placeholder="Email" value="demo@example.com">
                <input type="password" name="password" placeholder="Password" value="password">
                
                <div style="margin-top: 20px;">
                    <button type="submit" name="action" value="approve" class="approve">Authorize</button>
                    <button type="submit" name="action" value="deny" class="deny">Deny</button>
                </div>
            </form>
        </div>
    </body>
    </html>`;

    res.send(consentPageHtml);

  } catch (error) {
    logger.error('Authorization endpoint error', { error });
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
});

// OAuth2 Authorization POST endpoint (user consent)
router.post('/authorize', async (req, res) => {
  try {
    logger.info('Authorization POST request received', { 
      body: { ...req.body, password: '[REDACTED]' },
      ip: req.ip 
    });

    const { 
      client_id, 
      redirect_uri, 
      scope, 
      state, 
      email, 
      password, 
      action
    } = req.body;

    // Handle denial
    if (action === 'deny') {
      const errorUrl = new URL(redirect_uri);
      errorUrl.searchParams.set('error', 'access_denied');
      errorUrl.searchParams.set('error_description', 'User denied authorization');
      if (state) errorUrl.searchParams.set('state', state);
      
      return res.redirect(errorUrl.toString());
    }

    // Simple demo authentication
    if (email !== 'demo@example.com' || password !== 'password') {
      return res.status(401).json({
        error: 'invalid_grant',
        error_description: 'Invalid user credentials'
      });
    }

    // Generate authorization code
    const userId = 'demo-user-id';
    const scopes = scope ? scope.split(' ') : ['read'];
    
    const authCode = await oauth2Server.generateAuthorizationCode(
      client_id,
      userId,
      redirect_uri,
      scopes
    );

    // Redirect with authorization code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', authCode);
    if (state) redirectUrl.searchParams.set('state', state);

    logger.info('Authorization code generated', { 
      code: authCode.substring(0, 10) + '...',
      userId,
      clientId: client_id
    });

    res.redirect(redirectUrl.toString());
    
  } catch (error) {
    logger.error('Authorization POST endpoint error', { error });
    
    // Redirect with error
    try {
      const errorUrl = new URL(req.body.redirect_uri);
      errorUrl.searchParams.set('error', 'server_error');
      errorUrl.searchParams.set('error_description', 'Authorization failed');
      if (req.body.state) errorUrl.searchParams.set('state', req.body.state);
      
      res.redirect(errorUrl.toString());
    } catch (redirectError) {
      res.status(500).json({
        error: 'server_error',
        error_description: 'Authorization failed'
      });
    }
  }
});

// OAuth2 Token endpoint
// POST /oauth/token
router.post('/token', async (req, res) => {
  try {
    logger.info('Token request received', { 
      body: { ...req.body, client_secret: '[REDACTED]' },
      ip: req.ip 
    });

    const { grant_type, code, redirect_uri, client_id, client_secret, refresh_token } = req.body;

    if (grant_type === 'authorization_code') {
      // Authorization code flow
      const token = await oauth2Server.exchangeCodeForToken(
        code,
        client_id,
        client_secret,
        redirect_uri
      );

      logger.info('Token issued successfully', { 
        accessToken: token.accessToken.substring(0, 10) + '...',
        scopes: token.scopes 
      });

      res.json({
        access_token: token.accessToken,
        token_type: token.tokenType,
        expires_in: token.expiresIn,
        refresh_token: token.refreshToken,
        scope: token.scopes.join(' ')
      });

    } else if (grant_type === 'refresh_token') {
      // Refresh token flow
      const token = await oauth2Server.refreshToken(refresh_token, client_id, client_secret);

      logger.info('Token refreshed successfully', { 
        accessToken: token.accessToken.substring(0, 10) + '...',
        scopes: token.scopes 
      });

      res.json({
        access_token: token.accessToken,
        token_type: token.tokenType,
        expires_in: token.expiresIn,
        refresh_token: token.refreshToken,
        scope: token.scopes.join(' ')
      });

    } else if (grant_type === 'client_credentials') {
      // Client credentials flow
      const scopes = req.body.scope ? req.body.scope.split(' ') : ['read'];
      const token = await oauth2Server.generateClientToken(client_id, client_secret, scopes);

      logger.info('Client credentials token issued', { 
        accessToken: token.accessToken.substring(0, 10) + '...',
        scopes: token.scopes 
      });

      res.json({
        access_token: token.accessToken,
        token_type: token.tokenType,
        expires_in: token.expiresIn,
        scope: token.scopes.join(' ')
      });

    } else {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Supported grant types: authorization_code, refresh_token, client_credentials'
      });
    }

  } catch (error) {
    logger.error('Token endpoint error', { error: error.message });
    
    if (error.message.includes('Invalid client')) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: error.message
      });
    }
    
    if (error.message.includes('Invalid authorization code') || error.message.includes('expired')) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: error.message
      });
    }

    res.status(400).json({
      error: 'invalid_request',
      error_description: error.message || 'Token request failed'
    });
  }
});

// OAuth2 Token Revocation endpoint
// POST /oauth/revoke
router.post('/revoke', async (req, res) => {
  try {
    logger.info('Token revocation request received', { ip: req.ip });

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing token parameter'
      });
    }

    await oauth2Server.revokeToken(token);
    logger.info('Token revoked successfully', { 
      token: token.substring(0, 10) + '...' 
    });

    // Always return 200 for security (don't reveal if token exists)
    res.status(200).json({ revoked: true });

  } catch (error) {
    logger.error('Token revocation error', { error });
    res.status(500).json({
      error: 'server_error',
      error_description: 'Token revocation failed'
    });
  }
});

// OAuth2 UserInfo endpoint
// GET /oauth/userinfo
router.get('/userinfo', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Missing or invalid authorization header'
      });
    }

    const accessToken = authHeader.substring(7);
    const userInfo = await oauth2Server.getUserInfo(accessToken);

    logger.info('UserInfo request', { userId: userInfo.sub });
    res.json(userInfo);

  } catch (error) {
    logger.error('UserInfo endpoint error', { error });
    res.status(401).json({
      error: 'invalid_token',
      error_description: 'Invalid or expired access token'
    });
  }
});

// OAuth2 Discovery endpoint (OpenID Connect)
// GET /.well-known/oauth-authorization-server
router.get('/.well-known/oauth-authorization-server', (req, res) => {
  const issuer = config.oauth2.issuer;
  
  const discovery = {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    userinfo_endpoint: `${issuer}/oauth/userinfo`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    scopes_supported: ['read', 'write', 'admin'],
    code_challenge_methods_supported: ['S256', 'plain']
  };

  res.json(discovery);
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const health = await oauth2Server.healthCheck();
    res.json({
      status: 'healthy',
      service: 'oauth2-service',
      timestamp: new Date().toISOString(),
      ...health
    });
  } catch (error) {
    logger.error('Health check error', { error });
    res.status(500).json({
      status: 'unhealthy',
      service: 'oauth2-service',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

export default router;