// 簡易 in-memory rate limiter — 不引入第三方 dep（attack surface ↓）
//
// 對 /api/auth/google 這類「每次 request 會打外部 API（Google verifyIdToken）」的端點，
// 沒有 rate limit 等於把 Google API quota 與 server CPU 暴露給 brute-force / DoS。
//
// 設計：
// - sliding window：每 key 存近 N 次 timestamp，新請求進來時清掉超過 window 的
// - key = cf-connecting-ip（cloudflared 後方）→ req.ip → 'unknown'
// - 超過 max 回 429 + Retry-After header
// - 定期 GC 過期 bucket 防 memory leak

function getKey(req) {
  return (
    req.get('cf-connecting-ip') ||
    req.ip ||
    'unknown'
  );
}

export function createRateLimiter({ windowMs, max, name = 'rate-limit' }) {
  const buckets = new Map();

  // GC：每 windowMs 跑一次，清掉已過期的 bucket
  const gcInterval = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, arr] of buckets) {
      const fresh = arr.filter(t => t > cutoff);
      if (fresh.length === 0) buckets.delete(key);
      else buckets.set(key, fresh);
    }
  }, windowMs);
  gcInterval.unref();

  return function rateLimit(req, res, next) {
    const key = getKey(req);
    const now = Date.now();
    const arr = buckets.get(key) ?? [];
    const fresh = arr.filter(t => now - t < windowMs);

    if (fresh.length >= max) {
      const retryAfter = Math.ceil((fresh[0] + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      console.warn(`[${name}] rate limit hit for key=${key} (${fresh.length}/${max})`);
      return res.status(429).json({ error: 'too many requests' });
    }

    fresh.push(now);
    buckets.set(key, fresh);
    next();
  };
}
