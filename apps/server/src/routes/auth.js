import { Router } from 'express';
import { createRateLimiter } from '../services/rate-limit.js';

// 每 5 分鐘最多 10 次登入嘗試；超過會回 429。
// 防止攻擊者透過 brute-force 燒 Google verifyIdToken quota 與 server CPU。
const loginRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  name: 'auth/google',
});

export function authRouter(authGate) {
  const router = Router();

  router.post('/google', loginRateLimit, async (req, res) => {
    const { credential } = req.body ?? {};
    if (!credential) return res.status(400).json({ error: 'credential required' });
    try {
      const { token, user } = await authGate.loginWithGoogleCredential(credential);
      authGate.setSessionCookie(res, token);
      res.json({ ok: true, user });
    } catch (e) {
      res.status(e.status ?? 401).json({ error: e.message });
    }
  });

  router.post('/logout', authGate.middleware(), (req, res) => {
    authGate.clearSessionCookie(res, req.user.jti);
    res.json({ ok: true });
  });

  router.get('/me', authGate.middleware(), (req, res) => {
    res.json({ user: { email: req.user.email } });
  });

  return router;
}
