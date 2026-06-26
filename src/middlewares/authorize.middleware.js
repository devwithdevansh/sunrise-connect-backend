// src/middlewares/authorize.middleware.js
// Role-based access control. Call after authenticate.
// Usage: authorize('ADMIN', 'STAFF')
import AppError from '../utils/AppError.js';

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError('Not authenticated', 401));
  if (!roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  return next();
};

export default authorize;
