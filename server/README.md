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