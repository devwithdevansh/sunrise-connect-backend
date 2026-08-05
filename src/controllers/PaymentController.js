// src/controllers/PaymentController.js
import PaymentService from '../services/PaymentService.js';
import RazorpayService from '../services/RazorpayService.js';
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/response.js';
import AppError from '../utils/AppError.js';
import ledgerRepository from '../repositories/ledgerRepository.js';
import studentRepository from '../repositories/studentRepository.js';

class PaymentController {
  /** POST /api/v1/payments */
  static createPayment = catchAsync(async (req, res) => {
    if (req.user?.role === 'parent') {
      const ledger = await ledgerRepository.findById(req.body.ledgerId);
      if (!ledger) throw new AppError('Ledger not found', 404);
      const student = await studentRepository.findOne({ _id: ledger.studentId, parentId: req.user.id });
      if (!student) throw new AppError('You do not have permission to pay for this ledger', 403);
    }
    const payment = await PaymentService.createPayment({ ...req.body, performedBy: req.user?.id ?? null });
    sendResponse(res, 201, payment);
  });

  /** POST /api/v1/payments/batch */
  static createBatchPayments = catchAsync(async (req, res) => {
    const { payments } = req.body;
    if (req.user?.role === 'parent') {
      const ledgerIds = payments.map(p => p.ledgerId);
      const studentIds = await ledgerRepository.findDistinct('studentId', { _id: { $in: ledgerIds } });
      const studentCount = await studentRepository.countDocuments({
        _id: { $in: studentIds },
        parentId: req.user.id
      });
      const uniqueStudentIds = [...new Set(studentIds.map(id => id.toString()))];
      if (studentCount !== uniqueStudentIds.length) {
        throw new AppError('You do not have permission to pay for one or more selected ledgers', 403);
      }
    }
    const results = await PaymentService.createBatchPayments({
      payments,
      performedBy: req.user?.id ?? null
    });
    sendResponse(res, 201, results);
  });

  /** GET /api/v1/payments */
  static listPayments = catchAsync(async (req, res) => {
    const { limit = 20, skip = 0, ...filter } = req.query;
    
    // Dynamic import to avoid circular dependencies at top level if any, or just import it at top.
    const mongoose = (await import('mongoose')).default;

    if (filter.studentId) {
      let sId;
      try {
        sId = new mongoose.Types.ObjectId(filter.studentId);
      } catch (e) {
        return sendResponse(res, 400, 'Invalid studentId');
      }
      const ledgerIds = await ledgerRepository.findDistinct('_id', { studentId: sId });
      if (ledgerIds.length === 0) {
        return sendResponse(res, 200, []);
      }
      filter.ledgerIds = ledgerIds.map(id => id.toString()).join(',');
      delete filter.studentId;
    }
    
    if (req.user?.role === 'parent') {
      let parentId;
      try {
        parentId = new mongoose.Types.ObjectId(req.user.id);
      } catch (e) {
        return sendResponse(res, 400, 'Invalid parentId');
      }
      const studentIds = await studentRepository.findDistinct('_id', { parentId: parentId });
      const parentLedgerIds = await ledgerRepository.findDistinct('_id', { studentId: { $in: studentIds } });
      const parentLedgerIdStrs = parentLedgerIds.map(id => id.toString());

      if (filter.ledgerIds) {
        const requestedIds = filter.ledgerIds.split(',').map(id => id.trim()).filter(Boolean);
        const allowedIds = requestedIds.filter(id => parentLedgerIdStrs.includes(id));
        if (allowedIds.length === 0) {
          return sendResponse(res, 200, []);
        }
        filter.ledgerIds = allowedIds.join(',');
      } else if (filter.ledgerId) {
        if (!parentLedgerIdStrs.includes(filter.ledgerId)) {
          return sendResponse(res, 200, []);
        }
      } else {
        if (parentLedgerIdStrs.length === 0) {
          return sendResponse(res, 200, []);
        }
        filter.ledgerIds = parentLedgerIdStrs.join(',');
      }
    }
    const payments = await PaymentService.listPayments(filter, { limit: Number(limit), skip: Number(skip) });
    sendResponse(res, 200, payments);
  });

  /** GET /api/v1/payments/:id */
  static getPayment = catchAsync(async (req, res) => {
    const payment = await PaymentService.getPayment(req.params.id);
    sendResponse(res, 200, payment);
  });

  /** POST /api/v1/payments/:id/reverse (ADMIN only) */
  static reversePayment = catchAsync(async (req, res) => {
    const reversal = await PaymentService.reversePayment({ paymentId: req.params.id, ...req.body, performedBy: req.user?.id ?? null });
    sendResponse(res, 200, reversal);
  });

  /** POST /api/v1/payments/razorpay/order */
  static createRazorpayOrder = catchAsync(async (req, res) => {
    const { amount } = req.body;
    const order = await RazorpayService.createOrder({ 
      amount, 
      receipt: `receipt_${Date.now()}` 
    });
    sendResponse(res, 201, order);
  });

  /** POST /api/v1/payments/razorpay/verify */
  static verifyRazorpayPayment = catchAsync(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, payments } = req.body;

    const isValid = RazorpayService.verifySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      throw new AppError('Invalid payment signature', 400);
    }

    if (req.user?.role === 'parent') {
      const ledgerIds = payments.map(p => p.ledgerId);
      const studentIds = await ledgerRepository.findDistinct('studentId', { _id: { $in: ledgerIds } });
      const studentCount = await studentRepository.countDocuments({
        _id: { $in: studentIds },
        parentId: req.user.id
      });
      const uniqueStudentIds = [...new Set(studentIds.map(id => id.toString()))];
      if (studentCount !== uniqueStudentIds.length) {
        throw new AppError('You do not have permission to pay for one or more selected ledgers', 403);
      }
    }

    // Embed razorpay details in each payment
    const enrichedPayments = payments.map(p => ({
      ...p,
      method: 'ONLINE',
      details: {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        ...(p.details || {})
      }
    }));

    const results = await PaymentService.createBatchPayments({
      payments: enrichedPayments,
      performedBy: req.user?.id ?? null
    });
    
    sendResponse(res, 201, results);
  });
}

export default PaymentController;
