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
    return next();
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }
};

export default authenticate;
