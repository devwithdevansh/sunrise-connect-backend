// src/routes/fee-structure.routes.js
import { Router } from 'express';
import FeeStructureController from '../controllers/FeeStructureController.js';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createFeeStructureSchema,
  createTransportFeeStructureSchema,
  updateFeeStructureSchema,
  updateTransportFeeStructureSchema,
} from '../validations/fee-structure.schema.js';

const router = Router();

router.use(authenticate);

// GET — any authenticated staff/admin can view
router.get('/', FeeStructureController.list);

// POST/PUT — ADMIN only
router.post('/copy', authorize('ADMIN'), FeeStructureController.copyFeeStructures);
router.post('/', authorize('ADMIN'), validate(createFeeStructureSchema), FeeStructureController.createFeeStructure);
router.post('/transport', authorize('ADMIN'), validate(createTransportFeeStructureSchema), FeeStructureController.createTransportFeeStructure);
router.put('/:id', authorize('ADMIN'), validate(updateFeeStructureSchema), FeeStructureController.updateFeeStructure);
router.put('/transport/:id', authorize('ADMIN'), validate(updateTransportFeeStructureSchema), FeeStructureController.updateTransportFeeStructure);
router.delete('/:id', authorize('ADMIN'), FeeStructureController.deleteFeeStructure);
router.delete('/transport/:id', authorize('ADMIN'), FeeStructureController.deleteTransportFeeStructure);

export default router;
