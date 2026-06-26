// src/controllers/LedgerController.js
import LedgerService from '../services/LedgerService.js';
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/response.js';
import AppError from '../utils/AppError.js';

class LedgerController {
  /** POST /api/v1/ledgers */
  static createLedger = catchAsync(async (req, res) => {
    const ledger = await LedgerService.createLedger(req.body);
    sendResponse(res, 201, ledger);
  });

  /** GET /api/v1/ledgers */
  static listLedgers = catchAsync(async (req, res) => {
    const { limit = 20, skip = 0, ...filter } = req.query;
    if (req.user?.role === 'parent') {
      const mongoose = await import('mongoose');
      const studentIds = await mongoose.default.model('Student').find({ parentId: req.user.id }).distinct('_id');
      if (filter.studentId) {
        if (!studentIds.map(id => id.toString()).includes(filter.studentId)) {
          return sendResponse(res, 200, []);
        }
      } else {
        filter.studentId = { $in: studentIds };
      }
    }
    const ledgers = await LedgerService.listLedgers(filter, { limit: Number(limit), skip: Number(skip) });
    sendResponse(res, 200, ledgers);
  });

  /** GET /api/v1/ledgers/:id */
  static getLedger = catchAsync(async (req, res) => {
    const ledger = await LedgerService.getLedger(req.params.id);
    if (req.user?.role === 'parent') {
      const mongoose = await import('mongoose');
      const student = await mongoose.default.model('Student').findById(ledger.studentId);
      if (!student || student.parentId?.toString() !== req.user.id) {
        throw new AppError('You do not have permission to view this ledger', 403);
      }
    }
    sendResponse(res, 200, ledger);
  });

  /** POST /api/v1/ledgers/:id/payment */
  static addPayment = catchAsync(async (req, res) => {
    const ledger = await LedgerService.addPayment({ ledgerId: req.params.id, ...req.body });
    sendResponse(res, 200, ledger);
  });

  /** POST /api/v1/ledgers/:id/concession */
  static applyConcession = catchAsync(async (req, res) => {
    const ledger = await LedgerService.applyConcession({ ledgerId: req.params.id, ...req.body });
    sendResponse(res, 200, ledger);
  });

  /** PATCH /api/v1/ledgers/:id/mark-paid */
  static markAsPaid = catchAsync(async (req, res) => {
    const ledger = await LedgerService.markAsPaid(req.params.id);
    sendResponse(res, 200, ledger);
  });
}

export default LedgerController;
