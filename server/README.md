# MySQL API

The Ionic app stores accounts, planner collections, attachments, and activity history through this API. MySQL credentials stay on the server and are never included in the Angular app.

## Local setup

Requirements: Node.js 20 or newer and MySQL 8.0 or newer.

1. Create the database and tables: `mysql -u root -p < server/schema.sql`
2. Copy `server/.env.example` to `server/.env` and set the MySQL connection values.
3. Install API dependencies: `npm install --prefix server`
4. Start the API: `npm run start:api`
5. In another terminal, start the Ionic app: `npm start`

The API listens on port 3000 by default. The development Angular build uses `http://localhost:3000/api`; add any additional browser or Capacitor origins to `APP_ORIGINS`.

## Deployment

Use HTTPS and set `COOKIE_SECURE=true`. For a web deployment, proxy `/api` to the API server and keep `apiUrl` in `src/environments/environment.prod.ts` as `/api`. For a separately hosted API, set that value to its HTTPS API URL and add the app origin to `APP_ORIGINS`. When the app and API are cross-site (including some Capacitor deployments), set `COOKIE_SAME_SITE=none`; this requires secure cookies over HTTPS.

Do not expose the MySQL port or put database credentials in Angular environment files. Back up the MySQL database and configure your hosting provider's TLS, firewall, and secret management for production.