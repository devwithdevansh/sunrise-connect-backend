import AppError from '../utils/AppError.js';

/**
 * Middleware to restrict access to Super Admin (devansh@gmail.com)
 * This is a feature-flagging middleware for the ERP module.
 */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('You are not logged in', 401));
  }

  // The feature flag: only devansh@gmail.com can access ERP routes right now
  if (req.user.email !== 'devansh@gmail.com') {
    return next(new AppError('Forbidden. This feature is currently in restricted preview.', 403));
  }

  next();
};
