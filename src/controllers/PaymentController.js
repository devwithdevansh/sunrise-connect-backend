// src/controllers/PaymentController.js
import PaymentService from '../services/PaymentService.js';
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
      const ledgers = await ledgerRepository.find({ _id: { $in: ledgerIds } });
      const studentIds = ledgers.map(l => l.studentId);
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
    if (req.user?.role === 'parent') {
      const students = await studentRepository.find({ parentId: req.user.id });
      const studentIds = students.map(s => s._id);
      const parentLedgers = await ledgerRepository.find({ studentId: { $in: studentIds } });
      const parentLedgerIdStrs = parentLedgers.map(id => id._id.toString());

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
}

export default PaymentController;
