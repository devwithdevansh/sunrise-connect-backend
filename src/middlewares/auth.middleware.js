// src/middlewares/auth.middleware.js
// Verifies JWT and attaches decoded payload to req.user
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Missing or malformed Authorization header', 401));
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload; // { id, role }
    // Some controllers read req.user._id (Mongoose-doc convention) instead of
    // req.user.id (JWT-payload convention) — keep both populated so
    // teacher-scoped authorization (AllocationGuardService etc.) doesn't
    // silently receive `undefined` and skip its ownership checks.
    req.user._id = payload.id;
    return next();
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }
};

export default authenticate;
