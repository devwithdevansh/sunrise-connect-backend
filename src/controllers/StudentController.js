// src/controllers/StudentController.js
import StudentService from '../services/StudentService.js';
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/response.js';
import AppError from '../utils/AppError.js';

class StudentController {
  /** POST /api/v1/students */
  static createStudent = catchAsync(async (req, res) => {
    const student = await StudentService.createStudent(req.body, req.user?._id || req.user?.id);
    sendResponse(res, 201, student);
  });

  /** GET /api/v1/students */
  static listStudents = catchAsync(async (req, res) => {
    const { limit = 20, skip = 0, ...filter } = req.query;
    if (req.user?.role === 'parent') {
      filter.parentId = req.user.id;
    }
    const students = await StudentService.listStudents(filter, { limit: Number(limit), skip: Number(skip) });
    sendResponse(res, 200, students);
  });

  /** GET /api/v1/students/:id */
  static getStudent = catchAsync(async (req, res) => {
    const student = await StudentService.getStudent(req.params.id);
    const parentIdStr = student.parentId?._id ? student.parentId._id.toString() : student.parentId?.toString();
    if (req.user?.role === 'parent' && parentIdStr !== req.user.id) {
      throw new AppError('You do not have permission to view this student', 403);
    }
    sendResponse(res, 200, student);
  });

  /** PATCH /api/v1/students/:id */
  static updateStudent = catchAsync(async (req, res) => {
    const student = await StudentService.updateStudent(req.params.id, req.body, req.user?._id || req.user?.id);
    sendResponse(res, 200, student);
  });

  /** DELETE /api/v1/students/:id */
  static deleteStudent = catchAsync(async (req, res) => {
    const result = await StudentService.deleteStudent(req.params.id, req.user.id);
    const message = result.softDeleted 
      ? 'Student has payment history and was marked as inactive (soft deleted)' 
      : 'Student and all records successfully deleted';
    sendResponse(res, 200, null, message);
  });

  /** POST /api/v1/students/:id/restore */
  static restoreStudent = catchAsync(async (req, res) => {
    const student = await StudentService.restoreStudent(req.params.id, req.user.id);
    sendResponse(res, 200, student, 'Student successfully restored');
  });

  /** POST /api/v1/students/:id/regenerate-ledgers */
  static regenerateLedgers = catchAsync(async (req, res) => {
    const result = await StudentService.regenerateMissingLedgers(req.params.id);
    sendResponse(res, 200, result, `Synced ledgers: ${result.created} created, ${result.updated} updated`);
  });

  /** POST /api/v1/students/:id/custom-fee */
  static addCustomFee = catchAsync(async (req, res) => {
    const { feeName, amount } = req.body;
    if (!feeName || !amount) throw new AppError('Fee name and amount required', 400);
    const ledger = await StudentService.addCustomFee(req.params.id, feeName, amount);
    sendResponse(res, 201, ledger, 'Custom fee successfully added');
  });

  /** POST /api/v1/students/promote */
  static promoteStudents = catchAsync(async (req, res) => {
    const { studentIds, targetStandard, targetDivision, targetAcademicYear } = req.body;
    if (!studentIds || !Array.isArray(studentIds) || !targetStandard || !targetDivision || !targetAcademicYear) {
      throw new AppError('Missing required fields for promotion', 400);
    }
    const result = await StudentService.promoteStudents(studentIds, targetStandard, targetDivision, targetAcademicYear, req.user.id);
    sendResponse(res, 200, result);
  });

  /** POST /api/v1/students/import */
  static importStudents = catchAsync(async (req, res) => {
    const { students } = req.body;
    if (!students || !Array.isArray(students)) {
      throw new AppError('Missing students array in request body', 400);
    }
    const result = await StudentService.importStudents(students);
    sendResponse(res, 200, result);
  });

  /** PATCH /api/v1/students/fix-transport
   * Body: { studentIds: string[], transportStartMonth: string }
   * Deletes wrong transport ledgers and regenerates from correct start month.
   */
  static fixTransportLedgers = catchAsync(async (req, res) => {
    const { studentIds, transportStartMonth } = req.body;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      throw new AppError('studentIds array is required', 400);
    }
    if (!transportStartMonth) {
      throw new AppError('transportStartMonth is required', 400);
    }
    const result = await StudentService.fixTransportLedgers(studentIds, transportStartMonth);
    sendResponse(res, 200, result, `Fixed ${result.fixedCount} student(s)`);
  });
  /** POST /api/v1/students/auto-promote-batch
   * Body: { studentIds: string[] }
   * Auto promotes students to their next standard.
   */
  static autoPromoteBatch = catchAsync(async (req, res) => {
    const { studentIds } = req.body;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      throw new AppError('studentIds array is required', 400);
    }
    const result = await StudentService.autoPromoteBatch(studentIds, req.user?.id);
    sendResponse(res, 200, result, `Successfully auto-promoted ${result.promotedCount} student(s)`);
  });
}

export default StudentController;
