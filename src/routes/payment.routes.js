// src/routes/payment.routes.js
import { Router } from 'express';
import PaymentController from '../controllers/PaymentController.js';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import idempotency from '../middlewares/idempotency.middleware.js';
import {
  createPaymentSchema,
  reversePaymentSchema,
  listPaymentsSchema,
  batchPaymentSchema,
  createRazorpayOrderSchema,
  verifyRazorpayPaymentSchema,
} from '../validations/payment.schema.js';
// src/routes/payment.routes.js


const router = Router();

router.use(authenticate);

// Idempotency enforced on payment creation to prevent duplicate charges
router.post('/batch', authorize('ADMIN', 'STAFF', 'parent'), idempotency, validate(batchPaymentSchema), PaymentController.createBatchPayments);
router.post('/razorpay/order', authorize('ADMIN', 'STAFF', 'parent'), validate(createRazorpayOrderSchema), PaymentController.createRazorpayOrder);
router.post('/razorpay/verify', authorize('ADMIN', 'STAFF', 'parent'), idempotency, validate(verifyRazorpayPaymentSchema), PaymentController.verifyRazorpayPayment);
router.post('/', authorize('ADMIN', 'STAFF'), idempotency, validate(createPaymentSchema), PaymentController.createPayment);
router.get('/', authorize('ADMIN', 'STAFF', 'parent'), validate(listPaymentsSchema), PaymentController.listPayments);
router.get('/:id', authorize('ADMIN', 'STAFF'), PaymentController.getPayment);
router.post('/:id/reverse', authorize('ADMIN', 'STAFF'), validate(reversePaymentSchema), PaymentController.reversePayment);

export default router;
