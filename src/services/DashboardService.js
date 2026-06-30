// src/services/DashboardService.js
// Read-only aggregation service – no transactions, no audit entries.

import mongoose from 'mongoose';
import parentRepository from '../repositories/parentRepository.js';
import studentRepository from '../repositories/studentRepository.js';
import ledgerRepository from '../repositories/ledgerRepository.js';
import paymentRepository from '../repositories/paymentRepository.js';

class DashboardService {
  /** Aggregated view for a specific parent */
  static async getParentDashboard(parentId) {
    const studentCount = await studentRepository.countDocuments({ parentId, isActive: true });
    const ledgerAgg = await ledgerRepository.aggregate([
      { $match: { studentId: { $in: await studentRepository.find({ parentId, isActive: true }, '_id').then(s => s.map(x => x._id)) } } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          paidAmount: { $sum: '$paidAmount' },
          concessionAmount: { $sum: '$concessionAmount' },
          ledgerCount: { $sum: 1 },
        },
      },
    ]);
    const ledgerStats = ledgerAgg[0] || { totalAmount: 0, paidAmount: 0, concessionAmount: 0, ledgerCount: 0 };
    const recentPayments = await paymentRepository.find({}, null, { limit: 5, sort: { createdAt: -1 } });
    return { studentCount, ledgerStats, recentPayments };
  }

  /** Aggregated view for a specific student */
  static async getStudentDashboard(studentId) {
    const objectId = new mongoose.Types.ObjectId(studentId);
    const ledgerAgg = await ledgerRepository.aggregate([
      { $match: { studentId: objectId } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          paidAmount: { $sum: '$paidAmount' },
          concessionAmount: { $sum: '$concessionAmount' },
          ledgerCount: { $sum: 1 },
        },
      },
    ]);
    const ledgerStats = ledgerAgg[0] || { totalAmount: 0, paidAmount: 0, concessionAmount: 0, ledgerCount: 0 };
    return { ledgerStats };
  }

  /** System-wide metrics */
  static async getSystemMetrics() {
    const [parentCount, studentCount, ledgerAgg, paymentAgg] = await Promise.all([
      parentRepository.countDocuments({}),
      studentRepository.countDocuments({ isActive: true }),
      ledgerRepository.aggregate([
        { $group: { _id: null, totalAmount: { $sum: '$totalAmount' }, paidAmount: { $sum: '$paidAmount' }, concessionAmount: { $sum: '$concessionAmount' } } },
      ]),
      paymentRepository.aggregate([
        { $match: { isReversal: false } },
        { $group: { _id: null, totalPayments: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);
    return {
      parentCount,
      studentCount,
      ledgerStats: ledgerAgg[0] || { totalAmount: 0, paidAmount: 0, concessionAmount: 0 },
      paymentStats: paymentAgg[0] || { totalPayments: 0, count: 0 },
    };
  }
}

export default DashboardService;
