// src/routes/parent.routes.js
import { Router } from 'express';
import ParentController from '../controllers/ParentController.js';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createParentSchema,
  updateParentSchema,
  listParentsSchema,
  resetPasswordSchema,
  checkMobileSchema,
} from '../validations/parent.schema.js';

const router = Router();

// All parent routes require authentication
router.use(authenticate);

router.get('/check-mobile',     authorize('ADMIN', 'STAFF'), validate(checkMobileSchema), ParentController.checkMobile);
router.post('/',                authorize('ADMIN', 'STAFF'), validate(createParentSchema), ParentController.createParent);
router.get('/',                 authorize('ADMIN', 'STAFF'), validate(listParentsSchema),  ParentController.listParents);
router.get('/:id',              authorize('ADMIN', 'STAFF', 'parent'), ParentController.getParent);
router.patch('/:id',            authorize('ADMIN', 'STAFF'), validate(updateParentSchema), ParentController.updateParent);
router.post('/reset-password',  authorize('ADMIN'), validate(resetPasswordSchema), ParentController.resetParentPassword);

export default router;
