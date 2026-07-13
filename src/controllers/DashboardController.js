// src/controllers/DashboardController.js
import DashboardService from '../services/DashboardService.js';
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/response.js';
import mongoose from 'mongoose';
import Student from '../models/Student.js';
import ledgerRepository from '../repositories/ledgerRepository.js';
import paymentRepository from '../repositories/paymentRepository.js';
import AcademicYear from '../models/AcademicYear.js';
import FeeCategory from '../models/FeeCategory.js';
import FeeStructure from '../models/FeeStructure.js';
import TransportFeeStructure from '../models/TransportFeeStructure.js';
import AuditLog from '../models/AuditLog.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
class DashboardController {
  /** GET /api/v1/dashboard/system */
  static systemMetrics = catchAsync(async (req, res) => {
    const data = await DashboardService.getSystemMetrics();
    sendResponse(res, 200, data);
  });

  /** GET /api/v1/dashboard/parent/:id */
  static parentDashboard = catchAsync(async (req, res) => {
    const data = await DashboardService.getParentDashboard(req.params.id);
    sendResponse(res, 200, data);
  });

  /** GET /api/v1/dashboard/student/:id */
  static studentDashboard = catchAsync(async (req, res) => {
    const data = await DashboardService.getStudentDashboard(req.params.id);
    sendResponse(res, 200, data);
  });

  /** GET /api/v1/dashboard/init — BFF bundle endpoint to reduce parallel requests */
  static initDashboard = catchAsync(async (req, res) => {
    const [
      students,
      feeStructures,
      transportStructures,
      auditLogs,
      academicYears,
      feeCategories,
      transactions,
      users
    ] = await Promise.all([
      Student.find({}).populate('parentId', 'parentName primaryMobileNumber secondaryMobileNumber').lean(),
      FeeStructure.find({ isActive: true }).lean(),
      TransportFeeStructure.find({ isActive: true }).lean(),
      AuditLog.find().sort({ createdAt: -1 }).limit(100).lean(),
      AcademicYear.find({}).sort({ startDate: -1 }).lean(),
      FeeCategory.find({}).sort({ order: 1 }).lean(),
      Payment.find().sort({ createdAt: -1 }).limit(2000).populate({
        path: 'ledgerId',
        select: 'studentId academicYear feePeriod feeCategory totalAmount',
      }).lean(),
      User.find({}).select('-password').lean()
    ]);

    sendResponse(res, 200, {
      students,
      ledgers: [],
      transactions,
      feeStructures,
      transportStructures,
      auditLogs,
      academicYears,
      feeCategories,
      users
    });
  });

  /** GET /api/v1/dashboard/metrics */
  static getMetrics = catchAsync(async (req, res) => {
    const { date } = req.query; // YYYY-MM-DD
    const metrics = await DashboardService.getDailyMetrics(date);
    sendResponse(res, 200, metrics);
  });

  /** GET /api/v1/dashboard/sync-state */
  static getSyncState = catchAsync(async (req, res) => {
    const latestLog = await AuditLog.findOne().sort({ createdAt: -1 }).select('createdAt');
    const timestamp = latestLog ? latestLog.createdAt.getTime() : 0;
    sendResponse(res, 200, { timestamp });
  });
}

export default DashboardController;
