import 'dotenv/config';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import mysql from 'mysql2/promise';

const app = express();
const port = Number(process.env.PORT || 3000);
const cookieName = 'balikpinas_session';
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;
const offlineStorePath = new URL('./offline-store.json', import.meta.url);
const offlineStoreDir = fileURLToPath(new URL('.', import.meta.url));
const offlineStoreSeed = {
  users: [],
  sessions: [],
  plannerData: {},
  activity: {},
  attachments: {}
};
let offlineStore = structuredClone(offlineStoreSeed);
let useOfflineMode = process.env.OFFLINE_MODE === 'true';
const defaultDevelopmentOrigins = [
  'http://localhost:3000',
  'http://localhost:4200',
  'http://localhost:8100',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4200',
  'http://127.0.0.1:8100',
  'https://localhost',
  'capacitor://localhost'
];
const configuredOrigins = process.env.APP_ORIGINS ?? (
  process.env.NODE_ENV === 'production' ? '' : defaultDevelopmentOrigins.join(',')
);
const allowedOrigins = new Set(configuredOrigins
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean));
const collections = new Set(['trips', 'itinerary', 'budget', 'checklist', 'contacts', 'files']);
const attachmentTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'balikpinas_planner',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    const isDevelopmentTunnel = process.env.NODE_ENV !== 'production'
      && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(origin || '');
    const isLocalDevelopmentOrigin = process.env.NODE_ENV !== 'production'
      && /^(https?:\/\/)(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin || '');
    if (!origin || allowedOrigins.has(origin) || isDevelopmentTunnel || isLocalDevelopmentOrigin) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed'));
  }
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: process.env.COOKIE_SAME_SITE || 'lax',
  path: '/',
  maxAge: sessionDurationMs
});

async function loadOfflineStore() {
  try {
    const content = await readFile(offlineStorePath, 'utf8');
    offlineStore = JSON.parse(content);
  } catch {
    offlineStore = structuredClone(offlineStoreSeed);
  }
}

async function saveOfflineStore() {
  await mkdir(offlineStoreDir, { recursive: true });
  await writeFile(offlineStorePath, JSON.stringify(offlineStore, null, 2));
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createSessionCookie(response, token) {
  response.cookie(cookieName, token, cookieOptions());
}

function clearSessionCookie(response) {
  response.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined });
}

async function createSession(response, userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  if (useOfflineMode) {
    offlineStore.sessions = offlineStore.sessions.filter(session => session.user_id !== userId || session.expires_at > new Date().toISOString());
    offlineStore.sessions.push({ token_hash: hashToken(token), user_id: userId, expires_at: expiresAt.toISOString() });
    await saveOfflineStore();
    createSessionCookie(response, token);
    return;
  }
  await pool.execute(
    'INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [hashToken(token), userId, expiresAt]
  );
  createSessionCookie(response, token);
}

async function requireUser(request, response, next) {
  try {
    const token = request.cookies?.[cookieName];
    if (!token) return response.status(401).json({ error: 'Authentication required' });

    if (useOfflineMode) {
      const session = offlineStore.sessions.find(item => item.token_hash === hashToken(token) && item.expires_at > new Date().toISOString());
      if (!session) return response.status(401).json({ error: 'Session expired' });
      const user = offlineStore.users.find(item => item.id === session.user_id);
      if (!user) return response.status(401).json({ error: 'Session expired' });
      request.user = { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone };
      return next();
    }

    const [rows] = await pool.execute(
      `SELECT users.id, users.email, users.full_name AS fullName, users.phone
       FROM user_sessions
       JOIN users ON users.id = user_sessions.user_id
       WHERE user_sessions.token_hash = ? AND user_sessions.expires_at > CURRENT_TIMESTAMP(3)`,
      [hashToken(token)]
    );
    if (rows.length === 0) return response.status(401).json({ error: 'Session expired' });
    request.user = rows[0];
    return next();
  } catch (error) {
    return next(error);
  }
}

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(request, file, callback) {
    callback(null, attachmentTypes.has(file.mimetype));
  }
});

app.get('/api/health', async (request, response, next) => {
  try {
    if (useOfflineMode) {
      return response.json({ status: 'ok', mode: 'offline' });
    }
    await pool.query('SELECT 1');
    return response.json({ status: 'ok', mode: 'mysql' });
  } catch (error) {
    useOfflineMode = true;
    return response.json({ status: 'ok', mode: 'offline', warning: 'MySQL unavailable. Local offline mode enabled.' });
  }
});

app.post('/api/auth/register', authRateLimit, async (request, response, next) => {
  try {
    const email = String(request.body.email || '').trim().toLowerCase();
    const password = String(request.body.password || '');
    const fullName = String(request.body.fullName || '').trim();
    const phone = String(request.body.phone || '').trim();
    if (!email || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) {
      return response.status(400).json({ error: 'Enter a valid email address' });
    }
    if (password.length < 8 || password.length > 128) {
      return response.status(400).json({ error: 'Password must be 8 to 128 characters' });
    }

    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    if (useOfflineMode) {
      const existing = offlineStore.users.find(user => user.email === email);
      if (existing) return response.status(409).json({ error: 'An account with this email already exists' });
      offlineStore.users.push({ id: userId, email, password_hash: passwordHash, fullName, phone });
      await saveOfflineStore();
      await createSession(response, userId);
      return response.status(201).json({ id: userId, email, fullName, phone });
    }

    await pool.execute(
      'INSERT INTO users (id, email, password_hash, full_name, phone) VALUES (?, ?, ?, ?, ?)',
      [userId, email, passwordHash, fullName, phone]
    );
    await createSession(response, userId);
    return response.status(201).json({ id: userId, email, fullName, phone });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return response.status(409).json({ error: 'An account with this email already exists' });
    if (error.message === 'Origin is not allowed') return response.status(403).json({ error: 'Origin is not allowed' });
    return next(error);
  }
});

app.post('/api/auth/login', authRateLimit, async (request, response, next) => {
  try {
    const email = String(request.body.email || '').trim().toLowerCase();
    const password = String(request.body.password || '');

    if (useOfflineMode) {
      const user = offlineStore.users.find(item => item.email === email);
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return response.status(401).json({ error: 'Email or password is incorrect' });
      }
      await createSession(response, user.id);
      return response.json({ id: user.id, email: user.email, fullName: user.fullName, phone: user.phone });
    }

    const [rows] = await pool.execute(
      'SELECT id, email, password_hash, full_name AS fullName, phone FROM users WHERE email = ?',
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return response.status(401).json({ error: 'Email or password is incorrect' });
    }
    await createSession(response, user.id);
    return response.json({ id: user.id, email: user.email, fullName: user.fullName, phone: user.phone });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/auth/logout', async (request, response, next) => {
  try {
    const token = request.cookies?.[cookieName];
    if (useOfflineMode) {
      if (token) {
        offlineStore.sessions = offlineStore.sessions.filter(session => session.token_hash !== hashToken(token));
        await saveOfflineStore();
      }
      clearSessionCookie(response);
      return response.sendStatus(204);
    }
    if (token) await pool.execute('DELETE FROM user_sessions WHERE token_hash = ?', [hashToken(token)]);
    clearSessionCookie(response);
    return response.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

app.get('/api/auth/me', requireUser, (request, response) => response.json(request.user));

app.get('/api/collections/:name', requireUser, async (request, response, next) => {
  try {
    const name = request.params.name;
    if (!collections.has(name)) return response.sendStatus(404);
    if (useOfflineMode) {
      const userData = offlineStore.plannerData[request.user.id] ?? {};
      return response.json({ value: userData[name] ?? null });
    }
    const [rows] = await pool.execute(
      'SELECT payload FROM planner_data WHERE user_id = ? AND collection_name = ?',
      [request.user.id, name]
    );
    return response.json({ value: rows[0]?.payload ?? null });
  } catch (error) {
    return next(error);
  }
});

app.put('/api/collections/:name', requireUser, async (request, response, next) => {
  try {
    const name = request.params.name;
    if (!collections.has(name)) return response.sendStatus(404);
    if (useOfflineMode) {
      const userData = offlineStore.plannerData[request.user.id] ?? {};
      userData[name] = request.body.value;
      offlineStore.plannerData[request.user.id] = userData;
      await saveOfflineStore();
      return response.sendStatus(204);
    }
    const payload = JSON.stringify(request.body.value);
    await pool.execute(
      `INSERT INTO planner_data (user_id, collection_name, payload) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload)`,
      [request.user.id, name, payload]
    );
    return response.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

app.get('/api/activity', requireUser, async (request, response, next) => {
  try {
    if (useOfflineMode) {
      const userActivity = offlineStore.activity[request.user.id] ?? [];
      return response.json(userActivity);
    }
    const [rows] = await pool.execute(
      `SELECT id, action, description, email, amount, created_at AS createdAt
       FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [request.user.id]
    );
    return response.json(rows);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/activity', requireUser, async (request, response, next) => {
  try {
    const { action, description = '', email = null, amount = null } = request.body;
    const allowedActions = new Set(['registration', 'login', 'trip-created', 'expense-updated', 'file-uploaded']);
    if (!allowedActions.has(action) || typeof description !== 'string' || description.length > 500) {
      return response.status(400).json({ error: 'Invalid activity entry' });
    }
    if (useOfflineMode) {
      const userActivity = offlineStore.activity[request.user.id] ?? [];
      const entry = { id: randomUUID(), action, description, email, amount, createdAt: new Date().toISOString() };
      userActivity.unshift(entry);
      offlineStore.activity[request.user.id] = userActivity.slice(0, 100);
      await saveOfflineStore();
      return response.status(201).json({ id: entry.id });
    }
    const [result] = await pool.execute(
      `INSERT INTO activity_log (user_id, action, description, email, amount)
       VALUES (?, ?, ?, ?, ?)`,
      [request.user.id, action, description, email, amount]
    );
    return response.status(201).json({ id: result.insertId });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/attachments/:id', requireUser, upload.single('file'), async (request, response, next) => {
  try {
    if (!request.file || !attachmentTypes.has(request.file.mimetype)) {
      return response.status(400).json({ error: 'Choose a PDF, JPG, or PNG file' });
    }
    const originalName = request.file.originalname.slice(0, 255);
    if (useOfflineMode) {
      const userAttachments = offlineStore.attachments[request.user.id] ?? {};
      userAttachments[request.params.id] = {
        original_name: originalName,
        mime_type: request.file.mimetype,
        file_data: Buffer.from(request.file.buffer).toString('base64')
      };
      offlineStore.attachments[request.user.id] = userAttachments;
      await saveOfflineStore();
      return response.sendStatus(204);
    }
    await pool.execute(
      `INSERT INTO attachments (user_id, attachment_id, original_name, mime_type, file_data)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE original_name = VALUES(original_name), mime_type = VALUES(mime_type), file_data = VALUES(file_data)`,
      [request.user.id, request.params.id, originalName, request.file.mimetype, request.file.buffer]
    );
    return response.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

app.get('/api/attachments/:id', requireUser, async (request, response, next) => {
  try {
    if (useOfflineMode) {
      const userAttachments = offlineStore.attachments[request.user.id] ?? {};
      const file = userAttachments[request.params.id];
      if (!file) return response.sendStatus(404);
      const buffer = Buffer.from(file.file_data, 'base64');
      response.set({
        'Content-Type': file.mime_type,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
        'Content-Length': buffer.length,
        'Cache-Control': 'private, no-store'
      });
      return response.send(buffer);
    }
    const [rows] = await pool.execute(
      'SELECT original_name, mime_type, file_data FROM attachments WHERE user_id = ? AND attachment_id = ?',
      [request.user.id, request.params.id]
    );
    if (!rows[0]) return response.sendStatus(404);
    const file = rows[0];
    response.set({
      'Content-Type': file.mime_type,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
      'Content-Length': file.file_data.length,
      'Cache-Control': 'private, no-store'
    });
    return response.send(file.file_data);
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/attachments/:id', requireUser, async (request, response, next) => {
  try {
    if (useOfflineMode) {
      const userAttachments = offlineStore.attachments[request.user.id] ?? {};
      delete userAttachments[request.params.id];
      offlineStore.attachments[request.user.id] = userAttachments;
      await saveOfflineStore();
      return response.sendStatus(204);
    }
    await pool.execute(
      'DELETE FROM attachments WHERE user_id = ? AND attachment_id = ?',
      [request.user.id, request.params.id]
    );
    return response.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);
  if (error instanceof multer.MulterError) {
    return response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: 'The uploaded file is invalid or too large' });
  }
  if (error.message === 'Origin is not allowed') return response.status(403).json({ error: 'Origin is not allowed' });
  console.error(error);
  return response.status(500).json({ error: 'The server could not complete the request' });
});

await loadOfflineStore();
if (process.env.OFFLINE_MODE === 'true') {
  useOfflineMode = true;
}
try {
  if (!useOfflineMode) await pool.query('SELECT 1');
} catch {
  useOfflineMode = true;
  console.warn('MySQL unavailable, starting in offline mode.');
}
app.listen(port, () => console.log(`BalikPinas API listening on port ${port} (${useOfflineMode ? 'offline' : 'mysql'})`));