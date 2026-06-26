// src/middlewares/rateLimit.middleware.js
// Lightweight in-process rate limiter using a sliding-window map.
// For production, replace with redis-backed implementation.
import AppError from '../utils/AppError.js';

const store = new Map(); // key -> [timestamps]

/**
 * rateLimit({ windowMs, max })
 * Keyed by IP address.
 */
const rateLimit = ({ windowMs = 15 * 60 * 10000, max = 1000 } = {}) =>
  (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const timestamps = (store.get(key) || []).filter(t => now - t < windowMs);
    if (timestamps.length >= max) {
      return next(new AppError('Too many requests. Please try again later.', 429));
    }
    timestamps.push(now);
    store.set(key, timestamps);
    return next();
  };

/** Stricter limiter for auth endpoints */
export const authRateLimit = rateLimit({ windowMs: 15 * 60 * 10000, max: 1000 });

/** Default API limiter */
export const apiRateLimit = rateLimit({ windowMs: 15 * 60 * 10000, max: 2000 });

export default rateLimit;
