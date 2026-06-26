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

// Public – No app-level rate limiting; Hostinger WAF handles DDoS.
// Only Zod schema validation for security.
router.post('/portal/login',        validate(portalLoginSchema),   AuthController.portalLogin);
router.post('/parent/verify',       validate(verifyParentSchema),  AuthController.verifyParentLastFour);
router.post('/parent/set-password', validate(setPasswordSchema),   AuthController.setParentPassword);
router.post('/parent/login',        validate(parentLoginSchema),   AuthController.parentLogin);
router.post('/refresh',             validate(refreshTokenSchema),  AuthController.refreshToken);

// Protected
router.post('/logout',     authenticate, AuthController.logout);
router.post('/logout-all', authenticate, AuthController.logoutAll);

export default router;
