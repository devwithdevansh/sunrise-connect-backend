// src/middlewares/idempotency.middleware.js
// Idempotency key enforcement for payment creation endpoints.
// Stores processed keys in-process (replace with Redis in production).
import AppError from '../utils/AppError.js';

const processedKeys = new Map(); // key -> response snapshot
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Purge expired keys every hour to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of processedKeys.entries()) {
    if (now - val.ts > TTL_MS) processedKeys.delete(key);
  }
}, 60 * 60 * 1000);

const idempotency = (req, res, next) => {
  const key = req.headers['idempotency-key'];
  if (!key) {
    return next(new AppError('Idempotency-Key header is required for this endpoint', 400));
  }

  const existing = processedKeys.get(key);
  if (existing && Date.now() - existing.ts < TTL_MS) {
    // Replay the cached response
    return res.status(existing.status).json(existing.body);
  }

  // Monkey-patch res.json to capture the response for future replays
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    processedKeys.set(key, { status: res.statusCode, body, ts: Date.now() });
    return originalJson(body);
  };

  return next();
};

export default idempotency;
