import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

export const hashToken = token => createHash('sha256').update(token).digest('hex');

export function createAuthStore({ pool, isOffline, getOfflineStore, saveOfflineStore }) {
  // Serialize recovery mutations in the local file store, including concurrent resets.
  let pendingWrite = Promise.resolve();
  function writeOffline(operation) {
    const write = pendingWrite.then(operation);
    pendingWrite = write.catch(() => undefined);
    return write;
  }

  return {
    async issueReset(email, token, expiresAt) {
      if (isOffline()) {
        return writeOffline(async () => {
          const data = getOfflineStore();
          const user = data.users.find(item => item.email === email);
          if (!user) return false;
          data.passwordResets = (data.passwordResets ?? []).filter(item => item.expires_at > new Date().toISOString());
          data.passwordResets.push({ token_hash: hashToken(token), user_id: user.id, expires_at: expiresAt.toISOString() });
          await saveOfflineStore();
          return true;
        });
      }
      await pool.execute('DELETE FROM password_reset_tokens WHERE expires_at <= CURRENT_TIMESTAMP(3)');
      const [result] = await pool.execute(
        `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
         SELECT ?, id, ? FROM users WHERE email = ?`,
        [hashToken(token), expiresAt, email]
      );
      return result.affectedRows > 0;
    },

    async resetPassword(token, passwordHash) {
      if (isOffline()) {
        return writeOffline(async () => {
          const data = getOfflineStore();
          const reset = (data.passwordResets ?? []).find(item => item.token_hash === hashToken(token)
            && item.expires_at > new Date().toISOString());
          const user = reset && data.users.find(item => item.id === reset.user_id);
          if (!user) return false;
          user.password_hash = passwordHash;
          data.sessions = data.sessions.filter(item => item.user_id !== user.id);
          data.passwordResets = data.passwordResets.filter(item => item.user_id !== user.id);
          await saveOfflineStore();
          return true;
        });
      }
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute(
          `SELECT users.id FROM users JOIN password_reset_tokens ON users.id = password_reset_tokens.user_id
           WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP(3) FOR UPDATE`, [hashToken(token)]
        );
        if (!rows[0]) {
          await connection.rollback();
          return false;
        }
        const userId = rows[0].id;
        await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
        await connection.execute('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
        await connection.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [userId]);
        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async googleUser(profile) {
      // A Google account is identified by its subject, never by a changing email address.
      if (isOffline()) {
        return writeOffline(async () => {
          const data = getOfflineStore();
          const identities = data.googleIdentities ??= {};
          const existing = data.users.find(item => item.id === identities[profile.sub]);
          if (existing) return existing;
          if (data.users.some(item => item.email === profile.email)) return null;
          const user = { id: randomUUID(), email: profile.email, fullName: profile.name, phone: '',
            password_hash: await bcrypt.hash(randomBytes(32).toString('base64url'), 12) };
          data.users.push(user);
          identities[profile.sub] = user.id;
          await saveOfflineStore();
          return user;
        });
      }
      const [rows] = await pool.execute(
        `SELECT users.id, users.email, users.full_name AS fullName, users.phone FROM google_identities
         JOIN users ON users.id = google_identities.user_id WHERE google_subject = ?`, [profile.sub]
      );
      if (rows[0]) return rows[0];
      const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [profile.email]);
      if (existing[0]) return null;
      const user = { id: randomUUID(), email: profile.email, fullName: profile.name, phone: '' };
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('base64url'), 12);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute(
          'INSERT INTO users (id, email, password_hash, full_name, phone) VALUES (?, ?, ?, ?, ?)',
          [user.id, user.email, passwordHash, user.fullName, user.phone]
        );
        await connection.execute('INSERT INTO google_identities (google_subject, user_id) VALUES (?, ?)', [profile.sub, user.id]);
        await connection.commit();
        return user;
      } catch (error) {
        await connection.rollback();
        // Two browser tabs may finish sign-in for the same new identity concurrently.
        if (error.code === 'ER_DUP_ENTRY') {
          const [identities] = await pool.execute(
            `SELECT users.id, users.email, users.full_name AS fullName, users.phone FROM google_identities
             JOIN users ON users.id = google_identities.user_id WHERE google_subject = ?`, [profile.sub]
          );
          return identities[0] ?? null;
        }
        throw error;
      } finally {
        connection.release();
      }
    }
  };
}
