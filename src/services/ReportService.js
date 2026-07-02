// src/services/ReportService.js
import mongoose from 'mongoose';
import StudentFeeLedger from '../models/StudentFeeLedger.js';
import Payment from '../models/Payment.js';
import Student from '../models/Student.js';

class ReportService {
  /** 
   * Get unpaid report aggregating all students 
   */
  static async getUnpaidReport(filters = {}) {
    const studentMatch = {};
    if (filters.standard) {
      studentMatch['standard'] = filters.standard;
    }
    // We only want ledgers that are not paid and have a remaining amount.
    const ledgerMatch = {
      status: { $ne: 'PAID' },
      remainingAmount: { $gt: 0 }
    };
    if (filters.academicYearId) {
      ledgerMatch.academicYear = new mongoose.Types.ObjectId(filters.academicYearId);
    }
    if (filters.studentIds) {
      const idsArray = filters.studentIds.split(',').map(id => new mongoose.Types.ObjectId(id.trim()));
      ledgerMatch.studentId = { $in: idsArray };
    }

    const pipeline = [
      { $match: ledgerMatch },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: '$student' }
    ];

    if (Object.keys(studentMatch).length > 0) {
      pipeline.push({
        $match: {
          'student.standard': studentMatch.standard
        }
      });
    }

    pipeline.push({
      $lookup: {
        from: 'payments',
        localField: 'student._id',
        foreignField: 'studentId',
        as: 'payments'
      }
    });

    pipeline.push({
      $addFields: {
        lastPayment: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$payments',
                as: 'p',
                cond: { $ne: ['$$p.isReversal', true] } // ignoring reversed payments
              }
            },
            -1 // wait, arrayElemAt -1 is just the last element, but payments isn't sorted.
          ]
        }
      }
    });
    // Actually, to get max payment date, we can do $max
    pipeline.push({
      $addFields: {
        lastPaidDate: { $max: '$payments.createdAt' }
      }
    });

    pipeline.push({
      $group: {
        _id: '$student._id',
        studentName: { $first: '$student.name' },
        standard: { $first: '$student.standard' },
        division: { $first: '$student.division' },
        rollNumber: { $first: '$student.rollNumber' },
        totalPendingAmount: { $sum: '$remainingAmount' },
        pendingLedgers: { $push: '$$ROOT' },
        lastPaidDate: { $first: '$lastPaidDate' }
      }
    });

    pipeline.push({ $sort: { standard: 1, division: 1, rollNumber: 1 } });

    const results = await StudentFeeLedger.aggregate(pipeline);
    return results;
  }

  /**
   * Get collection report for a given date range
   */
  static async getCollectionReport(filters = {}) {
    const { startDate, endDate } = filters;
    const matchStage = { isReversal: { $ne: true } };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) {
        matchStage.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        matchStage.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          date: { $first: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
          totalAmount: { $sum: '$amount' },
          cashAmount: {
            $sum: {
              $cond: [{ $eq: [{ $toUpper: '$method' }, 'CASH'] }, '$amount', 0]
            }
          },
          bankAmount: {
            $sum: {
              $cond: [{ $ne: [{ $toUpper: '$method' }, 'CASH'] }, '$amount', 0]
            }
          }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } }
    ];

    const results = await Payment.aggregate(pipeline);
    return results;
  }
}

export default ReportService;
