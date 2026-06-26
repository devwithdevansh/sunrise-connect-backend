// src/routes/auth.routes.js
import { Router } from 'express';
import AuthController from '../controllers/AuthController.js';
import authenticate from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authRateLimit } from '../middlewares/rateLimit.middleware.js';
import {
  portalLoginSchema,
  verifyParentSchema,
  setPasswordSchema,
  parentLoginSchema,
  refreshTokenSchema,
} from '../validations/auth.schema.js';

const router = Router();

// Public – rate-limited
router.post('/portal/login',    authRateLimit, validate(portalLoginSchema),   AuthController.portalLogin);
router.post('/parent/verify',   authRateLimit, validate(verifyParentSchema),  AuthController.verifyParentLastFour);
router.post('/parent/set-password', authRateLimit, validate(setPasswordSchema), AuthController.setParentPassword);
router.post('/parent/login',    authRateLimit, validate(parentLoginSchema),   AuthController.parentLogin);
router.post('/refresh',         authRateLimit, validate(refreshTokenSchema),  AuthController.refreshToken);

// Protected
router.post('/logout',     authenticate, AuthController.logout);
router.post('/logout-all', authenticate, AuthController.logoutAll);

export default router;
