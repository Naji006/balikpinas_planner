import { createRemoteJWKSet, jwtVerify } from 'jose';

export function createAuthProviders(env = process.env) {
  const production = env.NODE_ENV === 'production';
  // Endpoint overrides allow local provider verification. Production always uses the providers.
  const emailApi = !production && env.EMAIL_API_URL || 'https://api.resend.com';
  const googleAuthUrl = !production && env.GOOGLE_AUTHORIZATION_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
  const googleTokenUrl = !production && env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
  const googleKeysUrl = !production && env.GOOGLE_JWKS_URL || 'https://www.googleapis.com/oauth2/v3/certs';
  const keys = createRemoteJWKSet(new URL(googleKeysUrl));

  return {
    emailConfigured: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM && env.APP_URL),
    googleConfigured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.APP_URL),
    authorizationUrl({ state, nonce, challenge, redirectUri }) {
      const url = new URL(googleAuthUrl);
      url.search = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code',
        scope: 'openid email profile', state, nonce, code_challenge: challenge,
        code_challenge_method: 'S256', prompt: 'select_account'
      }).toString();
      return url.toString();
    },
    async googleProfile({ code, verifier, nonce, redirectUri }) {
      const response = await fetch(googleTokenUrl, {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier
        })
      });
      if (!response.ok) throw new Error('Google token exchange failed');
      const tokens = await response.json();
      const { payload } = await jwtVerify(tokens.id_token, keys, {
        algorithms: ['RS256'], issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: env.GOOGLE_CLIENT_ID, requiredClaims: ['exp', 'iat', 'sub', 'nonce', 'email', 'email_verified']
      });
      if (payload.nonce !== nonce || payload.email_verified !== true
        || (payload.azp !== undefined && payload.azp !== env.GOOGLE_CLIENT_ID)
        || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255
        || typeof payload.email !== 'string' || payload.email.length > 254 || !/^\S+@\S+\.\S+$/.test(payload.email)) {
        throw new Error('Google identity is invalid');
      }
      return { sub: payload.sub, email: payload.email.trim().toLowerCase(),
        name: typeof payload.name === 'string' ? payload.name.slice(0, 160) : '' };
    },
    async sendResetEmail(email, resetUrl) {
      const response = await fetch(`${emailApi.replace(/\/$/, '')}/emails`, {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.EMAIL_FROM, to: [email], subject: 'Reset your BalikPinas Planner password',
          text: `Use this link to choose a new password:\n\n${resetUrl}\n\nThis link expires in 30 minutes and can be used once. If you did not request it, you can ignore this email.`
        })
      });
      if (!response.ok) throw new Error('Reset email delivery failed');
    }
  };
}
