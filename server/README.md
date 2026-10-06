# MySQL API

The Ionic app stores accounts, planner collections, attachments, and activity history through this API. MySQL credentials stay on the server and are never included in the Angular app.

## Local setup

Requirements: Node.js 20 or newer and MySQL 8.0 or newer.

1. Create the database and tables: `mysql -u root -p < server/schema.sql`
2. Copy `server/.env.example` to `server/.env` and set the MySQL connection values.
3. Install API dependencies: `npm install --prefix server`
4. Start the Node API: `npm run start:api`
5. In another terminal, start the Ionic app: `npm start`

If the database already exists, rerun `mysql -u root -p < server/schema.sql` to create the login rate-limit table; existing tables and data are preserved.

The Node API listens on port 3000 by default and handles registration, login, and session management. Add any additional browser or Capacitor origins to `APP_ORIGINS`.

For a Cloudflare Tunnel development session, expose the Angular dev server port (8100 if configured that way), not the API port. The app uses same-origin `/api` requests, and the Angular dev-server proxy forwards them to the Node API on port 3000. Keep the Node API and MySQL running on the machine hosting the tunnel.

## Offline use

Sign in once while connected. Planner collections are cached in the browser for that account, so they can be viewed and edited when the API is unreachable. Offline collection edits are saved on the device and sent to the API when the connection returns; the most recent offline version of a collection is applied during sync. The cached session and planner data remain on that device. Registration, a first sign-in, activity history, and attachment uploads still require the API.

## Deployment

Use HTTPS and set `COOKIE_SECURE=true`. For a web deployment, proxy `/api` to the Node API. For separately hosted services, add the app origin to `APP_ORIGINS` and configure cookies for the deployment; cross-site cookies require `COOKIE_SAME_SITE=none` and secure cookies over HTTPS.

Do not expose the MySQL port or put database credentials in Angular environment files. Back up the MySQL database and configure your hosting provider's TLS, firewall, and secret management for production.

## Password recovery and Google sign-in

These features run through the Node API. The standalone PHP login endpoint does not implement them. Keep passwords hashed; recovery replaces a forgotten password with a new one.

### Existing MySQL or MariaDB database

Apply the additive migration once (it is safe to rerun):

```bash
mysql -u <database-user> -p balikpinas_planner < server/migrations/001-auth-recovery.sql
```

This creates `password_reset_tokens` and `google_identities`. Existing users and planner data are preserved. New installations can use `server/schema.sql` instead.

### Reset emails

Configure these values in `server/.env`, then restart the API:

- `APP_URL`: the public frontend origin, such as `https://planner.example.com`, with no path, query or fragment. Production requires HTTPS.
- `RESEND_API_KEY`: an email sending key from [Resend](https://resend.com/docs/api-reference/emails/send-email).
- `EMAIL_FROM`: a sender address on a verified Resend domain, such as `BalikPinas Planner <accounts@example.com>`.

Users select **Forgot Password?**, enter their email, open the emailed link, and choose a new password. The response does not disclose whether an account exists. Links expire after 30 minutes; only SHA-256 hashes of the random tokens are stored. Successful reset invalidates all reset links and sessions for that account, then returns the user to login. New passwords must contain at least 8 characters and fit within bcrypt's 72 UTF-8 byte limit.

Reset tokens are carried in the URL fragment and submitted only in the reset POST body. They are removed from browser history when the page opens. Reloading that page requires reopening the email link. Do not log request bodies on authentication endpoints. Delivery failures are reported in the API log without email addresses or reset tokens; a generic success response means the request was accepted, not that delivery was confirmed.

### Continue with Google

1. Create an OAuth client with type **Web application** in [Google Cloud](https://developers.google.com/identity/protocols/oauth2/openid-connect), configure the consent screen and add test users if the application is in testing mode.
2. Register the exact redirect URI: `https://planner.example.com/api/auth/google/callback`. Local default: `http://localhost:4200/api/auth/google/callback`. The callback must reach the Node API through your `/api` proxy.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `server/.env`. The secret must stay on the server.
4. Set `AUTH_FLOW_SECRET` to a random value with at least 32 bytes of entropy. Use the same secret across API instances; changing it invalidates pending Google flows. A single development instance generates a temporary secret when this setting is absent.
5. Set `COOKIE_SECURE=true` for HTTPS deployments. `GOOGLE_REDIRECT_URI` can override the default `APP_URL/api/auth/google/callback` if the API is separately hosted; register that exact URI in Google Cloud. Add the frontend origin to `APP_ORIGINS` and configure cross-site session cookies where required.

The server uses authorization code exchange with PKCE, a signed browser state cookie, a nonce, and RS256 ID token verification against Google's public keys. Tokens must have Google's issuer, the configured client audience, a valid expiry and a verified email. Google subjects are persisted separately from email addresses.

First Google sign-in creates an account with an unknown random password hash. Later sign-ins reuse its Google subject. An existing password account with the same email is not automatically linked: users are asked to use their password or reset it. A Google account can add a password through the reset email flow. Live Google consent is a browser flow; packaged Capacitor applications need a separately configured native OAuth flow.

### Validation

```bash
npm test --prefix server
# Also run the same suite against a disposable database with the schema installed:
TEST_DB_PORT=3307 TEST_DB_NAME=balikpinas_planner npm test --prefix server
```

The database test mode deletes its synthetic `traveler@example.test` and `google@example.test` fixtures. Use a disposable database. Tests cover reset token hashing, expiration, replay, concurrent redemption, session invalidation, OAuth state, signature, nonce, issuer, audience and verified email.

For local provider checks, nonproduction processes support `EMAIL_API_URL`, `GOOGLE_AUTHORIZATION_URL`, `GOOGLE_TOKEN_URL`, and `GOOGLE_JWKS_URL`. Production ignores these overrides. CodeRabbit emulate v0.0.1 supports the Resend email operations; its Google emulator uses HS256 with an empty JWKS, so it cannot complete this app's RS256 verification. The backend tests use signed RS256 fixtures to cover successful Google callbacks without weakening production verification.
