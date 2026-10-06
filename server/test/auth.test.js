import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createAuthStore, hashToken } from '../auth-store.js';
import { createAuthProviders } from '../auth-providers.js';
import { createAuthRouter } from '../auth-routes.js';

const cookieSecret = randomBytes(32).toString('hex');
const clientSecret = randomBytes(32).toString('hex');
const modes = ['offline'];
if (process.env.TEST_DB_PORT) modes.push('MariaDB');
let privateKey, jwk, providerServer, providerUrl;
const codes = new Map();
const sentEmails = [];

function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}
async function close(server) {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

before(async () => {
  const keys = await generateKeyPair('RS256');
  privateKey = keys.privateKey;
  jwk = { ...await exportJWK(keys.publicKey), kid: 'fixture-key', alg: 'RS256', use: 'sig' };
  const provider = express();
  provider.use(express.json());
  provider.use(express.urlencoded({ extended: false }));
  provider.get('/keys', (_request, response) => response.json({ keys: [jwk] }));
  provider.post('/emails', (request, response) => {
    sentEmails.push(request.body);
    response.json({ id: randomUUID() });
  });
  provider.post('/token', async (request, response) => {
    const code = codes.get(request.body.code);
    codes.delete(request.body.code);
    if (!code || request.body.client_id !== 'fixture-client' || request.body.client_secret !== clientSecret
      || createHash('sha256').update(request.body.code_verifier).digest('base64url') !== code.challenge) {
      return response.status(400).json({ error: 'invalid_grant' });
    }
    const claims = { sub: 'google-subject-1', email: 'google@example.test', email_verified: true,
      name: 'Google Traveler', nonce: code.nonce, ...code.claims };
    const key = code.badSignature ? (await generateKeyPair('RS256')).privateKey : privateKey;
    const token = await new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'fixture-key' })
      .setIssuer(code.issuer || 'https://accounts.google.com').setAudience(code.audience || 'fixture-client')
      .setIssuedAt().setExpirationTime(code.expired ? Math.floor(Date.now() / 1000) - 60 : '5m').sign(key);
    response.json({ id_token: token });
  });
  providerServer = await listen(provider);
  providerUrl = `http://127.0.0.1:${providerServer.address().port}`;
});
after(async () => close(providerServer));

for (const mode of modes) {
  describe(`Authentication (${mode})`, () => {
    let server, api, pool, data, userId, store, providers, latestIssue, latestDelivery;
    beforeEach(async () => {
      codes.clear();
      sentEmails.length = 0;
      latestIssue = Promise.resolve();
      latestDelivery = Promise.resolve();
      userId = randomUUID();
      const oldHash = await bcrypt.hash('old-password', 4);
      data = { users: [{ id: userId, email: 'traveler@example.test', fullName: 'Traveler', phone: '', password_hash: oldHash }],
        sessions: [{ user_id: userId, token_hash: hashToken('old-session'), expires_at: new Date(Date.now() + 60000).toISOString() }],
        passwordResets: [], googleIdentities: {} };
      if (mode === 'MariaDB') {
        pool = mysql.createPool({ host: '127.0.0.1', port: Number(process.env.TEST_DB_PORT), user: process.env.TEST_DB_USER || 'root',
          password: process.env.TEST_DB_PASSWORD || '', database: process.env.TEST_DB_NAME || 'balikpinas_planner', connectionLimit: 4 });
        await pool.execute('DELETE FROM users WHERE email IN (?, ?)', ['traveler@example.test', 'google@example.test']);
        await pool.execute('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [userId, 'traveler@example.test', oldHash]);
        await pool.execute('INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
          [hashToken('old-session'), userId, new Date(Date.now() + 60000)]);
      }
      store = createAuthStore({ pool, isOffline: () => mode === 'offline', getOfflineStore: () => data, saveOfflineStore: async () => {} });
      const issueReset = store.issueReset;
      store.issueReset = (...args) => latestIssue = issueReset(...args);
      providers = createAuthProviders({ APP_URL: 'http://localhost:4200', RESEND_API_KEY: `re_${randomBytes(16).toString('hex')}`,
        EMAIL_FROM: 'planner@example.test', EMAIL_API_URL: providerUrl, GOOGLE_CLIENT_ID: 'fixture-client',
        GOOGLE_CLIENT_SECRET: clientSecret, GOOGLE_AUTHORIZATION_URL: `${providerUrl}/authorize`,
        GOOGLE_TOKEN_URL: `${providerUrl}/token`, GOOGLE_JWKS_URL: `${providerUrl}/keys` });
      const sendEmail = providers.sendResetEmail;
      providers.sendResetEmail = (...args) => latestDelivery = sendEmail(...args);
      const app = express();
      app.use(cookieParser(cookieSecret));
      app.use(express.json());
      app.use('/api/auth', createAuthRouter({ store, providers, appUrl: 'http://localhost:4200',
        redirectUri: 'http://localhost:4200/api/auth/google/callback', cookieOptions: () => ({ httpOnly: true, sameSite: 'lax', path: '/' }),
        clearSessionCookie: response => response.clearCookie('balikpinas_session'),
        createSession: async (response, id) => response.cookie('balikpinas_session', id, { httpOnly: true }),
        authRateLimit: (_request, _response, next) => next() }));
      app.use((_error, _request, response, _next) => response.status(500).json({ error: 'server error' }));
      server = await listen(app);
      api = `http://127.0.0.1:${server.address().port}/api/auth`;
    });
    afterEach(async () => {
      await latestIssue;
      await latestDelivery;
      await close(server);
      if (pool) {
        await pool.execute('DELETE FROM users WHERE email IN (?, ?)', ['traveler@example.test', 'google@example.test']);
        await pool.end();
        pool = undefined;
      }
    });
    const post = (path, body) => fetch(`${api}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    async function requestReset() {
      const response = await post('forgot-password', { email: ' Traveler@Example.Test ' });
      assert.equal(response.status, 202);
      assert.deepEqual(Object.keys(await response.json()), ['message']);
      await latestIssue;
      await latestDelivery;
      const email = sentEmails.at(-1);
      assert.deepEqual(email.to, ['traveler@example.test']);
      const url = new URL(email.text.match(/http:\/\/[^\s]+/)[0]);
      assert.equal(url.pathname, '/reset-password');
      assert.equal(url.search, '');
      return new URLSearchParams(url.hash.slice(1)).get('token');
    }
    async function startGoogle(options = {}) {
      const response = await fetch(`${api}/google/start`);
      assert.equal(response.status, 200);
      const url = new URL((await response.json()).url);
      const cookie = response.headers.getSetCookie()[0].split(';')[0];
      const code = randomUUID();
      codes.set(code, { nonce: url.searchParams.get('nonce'), challenge: url.searchParams.get('code_challenge'), ...options });
      return { cookie, code, state: url.searchParams.get('state') };
    }
    function callback(flow) {
      return fetch(`${api}/google/callback?${new URLSearchParams({ code: flow.code, state: flow.state })}`,
        { headers: { Cookie: flow.cookie }, redirect: 'manual' });
    }

    it('returns the same response for known and unknown emails without exposing a token', async () => {
      const known = await post('forgot-password', { email: 'traveler@example.test' });
      await latestIssue;
      await latestDelivery;
      const unknown = await post('forgot-password', { email: 'unknown@example.test' });
      await latestIssue;
      assert.equal(unknown.status, known.status);
      assert.deepEqual(await unknown.json(), await known.json());
      assert.equal(sentEmails.length, 1);
    });
    it('changes the hash, revokes sessions and all reset links, and rejects replay', async () => {
      const token = await requestReset();
      const secondToken = await requestReset();
      if (mode === 'offline') assert.equal(data.passwordResets[0].token_hash, hashToken(token));
      else {
        const [rows] = await pool.execute('SELECT token_hash FROM password_reset_tokens WHERE user_id = ?', [userId]);
        assert.ok(rows.some(row => row.token_hash === hashToken(token)));
        assert.ok(rows.every(row => row.token_hash !== token));
      }
      const response = await post('reset-password', { token, password: 'new-password' });
      assert.equal(response.status, 204);
      assert.ok(response.headers.get('set-cookie').includes('balikpinas_session='));
      let passwordHash;
      if (mode === 'offline') {
        passwordHash = data.users[0].password_hash;
        assert.equal(data.sessions.length, 0);
        assert.equal(data.passwordResets.length, 0);
      } else {
        const [users] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [userId]);
        passwordHash = users[0].password_hash;
        for (const table of ['user_sessions', 'password_reset_tokens']) {
          const [rows] = await pool.execute(`SELECT COUNT(*) AS count FROM ${table} WHERE user_id = ?`, [userId]);
          assert.equal(rows[0].count, 0);
        }
      }
      assert.equal(await bcrypt.compare('new-password', passwordHash), true);
      assert.equal(await bcrypt.compare('old-password', passwordHash), false);
      assert.equal((await post('reset-password', { token, password: 'replayed-password' })).status, 400);
      assert.equal((await post('reset-password', { token: secondToken, password: 'replayed-password' })).status, 400);
    });
    it('rejects expired tokens and invalid passwords without consuming a valid token', async () => {
      const token = await requestReset();
      assert.equal((await post('reset-password', { token, password: 'short' })).status, 400);
      assert.equal((await post('reset-password', { token, password: 'é'.repeat(40) })).status, 400);
      const expiredAt = new Date(Date.now() - 60000);
      if (mode === 'offline') data.passwordResets[0].expires_at = expiredAt.toISOString();
      else await pool.execute('UPDATE password_reset_tokens SET expires_at = ? WHERE user_id = ?', [expiredAt, userId]);
      assert.equal((await post('reset-password', { token, password: 'new-password' })).status, 400);
    });
    it('allows only one simultaneous redemption of a reset token', async () => {
      const token = await requestReset();
      const responses = await Promise.all([post('reset-password', { token, password: 'first-password' }),
        post('reset-password', { token, password: 'second-password' })]);
      assert.deepEqual(responses.map(response => response.status).sort(), [204, 400]);
    });
    it('reports unavailable providers and validates email input', async () => {
      assert.equal((await post('forgot-password', { email: 'invalid' })).status, 400);
      providers.emailConfigured = false;
      assert.equal((await post('forgot-password', { email: 'traveler@example.test' })).status, 503);
      providers.googleConfigured = false;
      assert.equal((await fetch(`${api}/google/start`)).status, 503);
    });
    it('creates a Google identity after verifying a signed token and reuses it on later sign-in', async () => {
      const response = await callback(await startGoogle());
      assert.equal(response.status, 303);
      assert.equal(new URL(response.headers.get('location')).searchParams.get('google'), 'success');
      assert.ok(response.headers.getSetCookie().some(cookie => cookie.startsWith('balikpinas_session=')));
      const repeated = await callback(await startGoogle({ claims: { email: 'changed@example.test' } }));
      assert.equal(new URL(repeated.headers.get('location')).searchParams.get('google'), 'success');
      if (mode === 'offline') assert.equal(data.users.length, 2);
      else {
        const [rows] = await pool.execute('SELECT COUNT(*) AS count FROM google_identities');
        assert.equal(rows[0].count, 1);
      }
    });
    it('does not link a Google identity to an existing password account by email', async () => {
      const response = await callback(await startGoogle({ claims: { email: 'traveler@example.test' } }));
      assert.equal(new URL(response.headers.get('location')).searchParams.get('google'), 'existing-account');
      assert.ok(!response.headers.getSetCookie().some(cookie => cookie.startsWith('balikpinas_session=')));
    });
    it('rejects missing, mismatched, and tampered state cookies', async () => {
      const flow = await startGoogle();
      for (const invalid of [{ ...flow, state: 'wrong' }, { ...flow, cookie: '' }, { ...flow, cookie: flow.cookie.slice(0, -5) + 'bad' }]) {
        const response = await callback(invalid);
        assert.equal(new URL(response.headers.get('location')).searchParams.get('google'), 'failed');
      }
    });
    for (const [name, options] of Object.entries({
      'wrong nonce': { claims: { nonce: 'wrong' } }, 'unverified email': { claims: { email_verified: false } },
      'wrong audience': { audience: 'other-client' }, 'wrong issuer': { issuer: 'https://attacker.example.test' },
      'wrong authorized party': { claims: { azp: 'other-client' } },
      'expired identity': { expired: true }, 'invalid signature': { badSignature: true }
    })) {
      it(`rejects a Google token with ${name}`, async () => {
        const response = await callback(await startGoogle(options));
        assert.equal(new URL(response.headers.get('location')).searchParams.get('google'), 'failed');
        assert.ok(!response.headers.getSetCookie().some(cookie => cookie.startsWith('balikpinas_session=')));
      });
    }
  });
}
