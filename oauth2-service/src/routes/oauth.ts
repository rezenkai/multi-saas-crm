import express from 'express';
import { OAuth2ServerManager } from '../core/OAuth2Server';
import { logger } from '../utils/logger';
import { config } from '../config';

const router = express.Router();
const oauth2Server = new OAuth2ServerManager();

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
      state,
      code_challenge,
      code_challenge_method 
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
    const client = await oauth2Server.getModel().getClient(client_id as string);
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

    // For demo purposes, we'll render a simple consent page
    // In production, this would be a proper login/consent flow
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
                <input type="hidden" name="scope" value="${scope || ''}">
                <input type="hidden" name="state" value="${state || ''}">
                <input type="hidden" name="code_challenge" value="${code_challenge || ''}">
                <input type="hidden" name="code_challenge_method" value="${code_challenge_method || ''}">
                
                <h3>Login</h3>
                <input type="email" name="email" placeholder="Email" required>
                <input type="password" name="password" placeholder="Password" required>
                
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
      action,
      code_challenge,
      code_challenge_method 
    } = req.body;

    // Handle denial
    if (action === 'deny') {
      const errorUrl = new URL(redirect_uri);
      errorUrl.searchParams.set('error', 'access_denied');
      errorUrl.searchParams.set('error_description', 'User denied authorization');
      if (state) errorUrl.searchParams.set('state', state);
      
      return res.redirect(errorUrl.toString());
    }

    // Validate user credentials
    const user = await oauth2Server.getModel().getUser(email, password);
    if (!user) {
      return res.status(401).json({
        error: 'invalid_grant',
        error_description: 'Invalid user credentials'
      });
    }

    // Create authorization code request
    const request = {
      query: { response_type: 'code' },
      body: {
        client_id,
        redirect_uri,
        scope: scope || config.oauth2.defaultScopes.join(' '),
        code_challenge,
        code_challenge_method
      },
      headers: {},
      method: 'POST',
      user
    } as any;

    const response = {
      redirect: (url: string) => res.redirect(url)
    } as any;

    // Use OAuth2 server to handle authorization
    const authResponse = await oauth2Server.getServer().authorize(request, response);
    
    // If we get here, the authorization was successful
    // The OAuth2 server should have already called response.redirect()
    
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

    const request = {
      body: req.body,
      headers: req.headers,
      method: 'POST',
      query: req.query
    } as any;

    const response = {
      body: {},
      status: 200,
      headers: {},
      set: (field: string, value: string) => {
        response.headers[field] = value;
      },
      json: (data: any) => {
        response.body = data;
      },
      status: (code: number) => {
        response.status = code;
        return response;
      }
    } as any;

    const token = await oauth2Server.getServer().token(request, response);
    
    logger.info('Token issued successfully', { 
      accessToken: token.accessToken.substring(0, 10) + '...',
      scope: token.scope 
    });

    res.status(200).json({
      access_token: token.accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor((token.accessTokenExpiresAt.getTime() - Date.now()) / 1000),
      refresh_token: token.refreshToken,
      scope: Array.isArray(token.scope) ? token.scope.join(' ') : token.scope
    });

  } catch (error) {
    logger.error('Token endpoint error', { error: error.message });
    
    // Map OAuth2 errors to proper HTTP responses
    if (error.name === 'InvalidClientError') {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: error.message
      });
    }
    
    if (error.name === 'InvalidGrantError') {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: error.message
      });
    }
    
    if (error.name === 'UnsupportedGrantTypeError') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
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

    const { token, token_type_hint } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing token parameter'
      });
    }

    // Authenticate client
    const clientId = req.body.client_id;
    const clientSecret = req.body.client_secret;
    
    const client = await oauth2Server.getModel().getClient(clientId, clientSecret);
    if (!client) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      });
    }

    // Find and revoke token
    const tokenModel = await oauth2Server.getModel().getAccessToken(token) || 
                      await oauth2Server.getModel().getRefreshToken(token);

    if (tokenModel) {
      await oauth2Server.getModel().revokeToken(tokenModel);
      logger.info('Token revoked successfully', { 
        token: token.substring(0, 10) + '...' 
      });
    }

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
    const request = {
      headers: req.headers,
      method: 'GET',
      query: req.query
    } as any;

    const response = {} as any;

    const token = await oauth2Server.getServer().authenticate(request, response);
    
    if (!token || !token.user) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid or expired access token'
      });
    }

    logger.info('UserInfo request', { userId: token.user.id });

    const userInfo = {
      sub: token.user.id,
      email: token.user.email,
      email_verified: true,
      name: token.user.profile.name,
      picture: token.user.profile.avatar,
      tenant_id: token.user.tenantId,
      scope: token.scope
    };

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
    jwks_uri: `${issuer}/oauth/jwks`,
    response_types_supported: ['code'],
    grant_types_supported: config.oauth2.allowedGrantTypes,
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    scopes_supported: config.oauth2.availableScopes,
    code_challenge_methods_supported: ['S256', 'plain']
  };

  res.json(discovery);
});

export default router;