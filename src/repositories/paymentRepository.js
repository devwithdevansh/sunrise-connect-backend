// src/repositories/paymentRepository.js
// Thin wrapper around the Payment Mongoose model.

import Payment from '../models/Payment.js';

const paymentRepository = {
  async create(data, opts = {}) {
    const [doc] = await Payment.create([data], opts);
    return doc;
  },

  async findById(id, projection = null, opts = {}) {
    return Payment.findById(id, projection, opts).lean();
  },

  async findOne(filter, projection = null, opts = {}) {
    return Payment.findOne(filter, projection, opts).lean();
  },

  async find(filter = {}, projection = null, opts = {}) {
    const { limit = 20, skip = 0, sort = { createdAt: -1 }, session } = opts;
    return Payment.find(filter, projection, { limit, skip, sort, session }).lean();
  },

  async updateOne(filter, update, opts = {}) {
    return Payment.updateOne(filter, update, opts);
  },

  async aggregate(pipeline, opts = {}) {
    return Payment.aggregate(pipeline, opts);
  },

  async countDocuments(filter = {}) {
    return Payment.countDocuments(filter);
  },

  /**
   * List payments joined with their ledger for full context (feePeriod, feeType, studentName).
   * Used by the parent-facing payment history & receipts endpoints.
   */
  async findWithLedger(filter = {}, { limit = 20, skip = 0 } = {}) {
    const matchStage = {};
    if (filter.ledgerIds) {
      const mongoose = await import('mongoose');
      const ids = typeof filter.ledgerIds === 'string'
        ? filter.ledgerIds.split(',').map(id => id.trim()).filter(Boolean)
        : Array.isArray(filter.ledgerIds)
          ? filter.ledgerIds
          : [];
      matchStage.ledgerId = { $in: ids.map(id => new mongoose.default.Types.ObjectId(id)) };
    } else if (filter.ledgerId) {
      const mongoose = await import('mongoose');
      matchStage.ledgerId = new mongoose.default.Types.ObjectId(filter.ledgerId);
    }
    if (filter.isReversal !== undefined) {
      matchStage.isReversal = filter.isReversal;
    }

    return Payment.aggregate([
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: 'studentfeeledgers',
          localField: 'ledgerId',
          foreignField: '_id',
          as: 'ledger',
        },
      },
      { $unwind: { path: '$ledger', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'payments',
          let: { paymentId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: '$details.reversalOf' },
                    { $toString: '$$paymentId' }
                  ]
                }
              }
            }
          ],
          as: 'reversals'
        }
      },
      {
        $project: {
          _id: 1,
          ledgerId: 1,
          amount: 1,
          method: 1,
          details: 1,
          isReversal: 1,
          createdAt: 1,
          updatedAt: 1,
          feePeriod: '$ledger.feePeriod',
          feeType: '$ledger.feeType',
          studentName: '$ledger.snapshot.studentName',
          academicYear: '$ledger.academicYear',
          concessionAmount: '$ledger.concessionAmount',
          totalAmount: '$ledger.totalAmount',
          isReversed: {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$isReversal', true] },
                  { $gt: [{ $size: '$reversals' }, 0] }
                ]
              },
              then: true,
              else: false
            }
          },
          reversalOf: '$details.reversalOf'
        },
      },
    ]);
  },
};

export default paymentRepository;
