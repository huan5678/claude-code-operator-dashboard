import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';

const COOKIE_NAME = 'codd_session';

// ⚠️ SINGLE-OPERATOR DESIGN
// 本系統假設只有「一個 ALLOWED_EMAIL」。所有 mutating 路由（kanban / sessions /
// identity / launch-profiles）沒有 resource-owner 檢查，因為單一 operator 不需要。
//
// 若未來改成 `ALLOWED_EMAILS=a,b` / 多人共用：
//   - 任一已登入 user 可看 其他 user 的 terminal session log（含密碼 / SSH key）
//   - 任一已登入 user 可改 SOUL.md / IDENTITY.md（影響其他 user 的 Claude 行為）
//   - 任一已登入 user 可殺 / 重啟 其他 user 的 PTY session
// 改 multi-user 前必須先：在 launch_profiles / terminal_sessions / kanban_cards
// schema 加 `owner_email` 欄位，並在每個 mutating route 加 ownership middleware。

const PLACEHOLDER_SECRETS = new Set([
  'replace_me_with_a_strong_64_char_hex_secret',
  'changeme',
  'change_me',
  'secret',
]);

export class AuthGate {
  constructor({ clientId, allowedEmail, sessionSecret, db, ttlDays = 7, isProd = false }) {
    if (!clientId) throw new Error('GOOGLE_CLIENT_ID is required');
    if (!allowedEmail) throw new Error('ALLOWED_EMAIL is required');
    if (!sessionSecret) throw new Error('SESSION_SECRET is required');
    if (!db) throw new Error('db is required');

    if (PLACEHOLDER_SECRETS.has(sessionSecret) || sessionSecret.length < 32) {
      throw new Error(
        'SESSION_SECRET is placeholder or too short. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    this.clientId = clientId;
    this.allowedEmail = allowedEmail.toLowerCase().trim();
    this.sessionSecret = sessionSecret;
    this.db = db;
    this.ttlSeconds = ttlDays * 24 * 60 * 60;
    this.isProd = isProd;
    this.oauthClient = new OAuth2Client(clientId);
  }

  async loginWithGoogleCredential(credential) {
    const ticket = await this.oauthClient.verifyIdToken({
      idToken: credential,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw httpError(401, 'no email in token');
    if (!payload.email_verified) throw httpError(403, 'email not verified');
    if (payload.email.toLowerCase() !== this.allowedEmail) {
      throw httpError(403, 'email not allowed');
    }
    const jti = randomBytes(16).toString('hex');
    const token = jwt.sign(
      { sub: payload.email, jti },
      this.sessionSecret,
      { expiresIn: this.ttlSeconds, algorithm: 'HS256' }
    );
    return { token, user: { email: payload.email, name: payload.name, picture: payload.picture } };
  }

  middleware() {
    return (req, res, next) => {
      const token = req.cookies?.[COOKIE_NAME];
      if (!token) return res.status(401).json({ error: 'unauthenticated' });
      try {
        const decoded = jwt.verify(token, this.sessionSecret, { algorithms: ['HS256'] });
        if (decoded.sub !== this.allowedEmail) {
          return res.status(403).json({ error: 'forbidden' });
        }
        const revoked = this.db
          .prepare('SELECT 1 FROM revoked_sessions WHERE jti = ?')
          .get(decoded.jti);
        if (revoked) return res.status(401).json({ error: 'session revoked' });
        req.user = { email: decoded.sub, jti: decoded.jti };
        next();
      } catch (e) {
        return res.status(401).json({ error: 'invalid session' });
      }
    };
  }

  setSessionCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'strict',
      maxAge: this.ttlSeconds * 1000,
      path: '/',
    });
  }

  clearSessionCookie(res, jti) {
    if (jti) {
      this.db.prepare('INSERT OR IGNORE INTO revoked_sessions (jti) VALUES (?)').run(jti);
    }
    res.clearCookie(COOKIE_NAME, { path: '/' });
  }
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
