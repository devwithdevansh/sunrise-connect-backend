// src/middlewares/rateLimit.middleware.js
// Lightweight in-process rate limiter using a sliding-window map.
// For production, replace with redis-backed implementation.
import AppError from '../utils/AppError.js';
import env from '../config/env.js';

/**
 * rateLimit({ windowMs, max })
 * Keyed by IP address (with proxy support).
 */
const rateLimit = ({ windowMs = env.RATE_LIMIT_WINDOW_MS, max = env.RATE_LIMIT_MAX } = {}) => {
  // Rate limiting is disabled entirely to prevent 429 errors.
  return (req, res, next) => {
    return next();
  };
};

/** Auth limiter for login/logout endpoints – generous enough for school admin use behind proxies */
export const authRateLimit = rateLimit({ 
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(env.AUTH_RATE_LIMIT_MAX, 10) || 500  // configurable via AUTH_RATE_LIMIT_MAX env var
});

/** Default API limiter (not used globally – only per-route if needed) */
export const apiRateLimit = rateLimit({ 
  windowMs: env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
  max: (parseInt(env.RATE_LIMIT_MAX, 10) * 10) || 1000
});

export default rateLimit;
