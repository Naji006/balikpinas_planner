import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';

const resetMessage = 'If an account exists for that email, a password reset link will be sent.';
const flowCookie = 'balikpinas_google_flow';

export function createAuthRouter({ store, providers, appUrl, redirectUri, cookieOptions, createSession, clearSessionCookie, authRateLimit }) {
  const router = Router();
  const flowOptions = () => ({ ...cookieOptions(), sameSite: 'lax', path: '/api/auth/google', maxAge: 10 * 60 * 1000 });
  function loginRedirect(response, result) {
    const url = new URL('/login', appUrl);
    url.searchParams.set('google', result);
    return response.redirect(303, url.toString());
  }

  router.post('/forgot-password', authRateLimit, (request, response) => {
    const email = String(request.body.email || '').trim().toLowerCase();
    if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) {
      return response.status(400).json({ error: 'Enter a valid email address' });
    }
    if (!providers.emailConfigured) return response.status(503).json({ error: 'Password reset is unavailable. Please try again later.' });
    // Respond before account lookup and email delivery to avoid revealing which addresses exist.
    response.status(202).json({ message: resetMessage });
    void (async () => {
      const token = randomBytes(32).toString('base64url');
      if (await store.issueReset(email, token, new Date(Date.now() + 30 * 60 * 1000))) {
        const url = new URL('/reset-password', appUrl);
        // A fragment keeps the reset token out of HTTP access logs and Referer headers.
        url.hash = new URLSearchParams({ token }).toString();
        await providers.sendResetEmail(email, url.toString());
      }
    })().catch(() => console.error('Password reset email could not be sent.'));
  });

  router.post('/reset-password', authRateLimit, async (request, response, next) => {
    try {
      const { token, password } = request.body;
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
        return response.status(400).json({ error: 'This reset link is invalid or has expired. Request a new link.' });
      }
      if (typeof password !== 'string' || password.length < 8 || password.length > 128 || Buffer.byteLength(password, 'utf8') > 72) {
        return response.status(400).json({ error: 'Use 8 to 128 characters, with a maximum of 72 UTF-8 bytes.' });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      if (!(await store.resetPassword(token, passwordHash))) {
        return response.status(400).json({ error: 'This reset link is invalid or has expired. Request a new link.' });
      }
      clearSessionCookie(response);
      return response.sendStatus(204);
    } catch (error) {
      return next(error);
    }
  });

  router.get('/google/start', authRateLimit, (request, response) => {
    if (!providers.googleConfigured) return response.status(503).json({ error: 'Google sign-in is unavailable. Please try again later.' });
    const flow = {
      state: randomBytes(32).toString('base64url'), nonce: randomBytes(32).toString('base64url'),
      verifier: randomBytes(32).toString('base64url'), expiresAt: Date.now() + 10 * 60 * 1000
    };
    const challenge = createHash('sha256').update(flow.verifier).digest('base64url');
    response.cookie(flowCookie, JSON.stringify(flow), { ...flowOptions(), signed: true });
    response.set('Cache-Control', 'no-store');
    return response.json({ url: providers.authorizationUrl({ ...flow, challenge, redirectUri }) });
  });

  router.get('/google/callback', authRateLimit, async (request, response) => {
    response.set('Cache-Control', 'no-store');
    const rawFlow = request.signedCookies?.[flowCookie];
    response.clearCookie(flowCookie, { ...flowOptions(), maxAge: undefined });
    if (!providers.googleConfigured || !appUrl) return response.status(503).send('Google sign-in is unavailable.');
    try {
      const flow = typeof rawFlow === 'string' && JSON.parse(rawFlow);
      if (!flow || flow.expiresAt <= Date.now() || typeof request.query.state !== 'string'
        || request.query.state !== flow.state) return loginRedirect(response, 'failed');
      if (request.query.error === 'access_denied') return loginRedirect(response, 'cancelled');
      if (typeof request.query.code !== 'string' || !request.query.code || request.query.error) return loginRedirect(response, 'failed');
      const profile = await providers.googleProfile({ code: request.query.code, ...flow, redirectUri });
      const user = await store.googleUser(profile);
      if (!user) return loginRedirect(response, 'existing-account');
      await createSession(response, user.id);
      return loginRedirect(response, 'success');
    } catch {
      return loginRedirect(response, 'failed');
    }
  });
  return router;
}
