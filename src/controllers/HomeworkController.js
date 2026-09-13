import Homework from '../models/Homework.js';
import AcademicYear from '../models/AcademicYear.js';
import AllocationGuardService from '../services/AllocationGuardService.js';
import verifyParentOwnsStudent from '../utils/verifyParentOwnsStudent.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import sendResponse from '../utils/response.js';

class HomeworkController {
  /**
   * POST /api/v1/erp/homework
   */
  static createHomework = catchAsync(async (req, res) => {
    const { standard, division, medium, subjectId, title, description, dueDate, attachments } = req.body;

    const activeYear = await AcademicYear.findOne({ isActive: true });
    if (!activeYear) {
      throw new AppError('No active academic year found', 400);
    }

    // Guard: Only the assigned subject teacher (or admin) can assign homework for this class & subject
    await AllocationGuardService.verifySubjectTeacherAccess(
      req.user,
      activeYear._id,
      standard,
      division,
      medium,
      subjectId
    );

    const homework = await Homework.create({
      academicYearId: activeYear._id,
      teacherId: req.user._id, // Set author as the requester
      standard,
      division,
      medium,
      subjectId,
      title,
      description,
      dueDate,
      attachments
    });

    sendResponse(res, 201, homework, 'Homework assigned successfully');
  });

  /**
   * GET /api/v1/erp/homework
   * Teachers get homework they assigned. Admins get all (filtered by query).
   * Parents get their own child's class homework (studentId required, ownership-checked).
   */
  static getHomework = catchAsync(async (req, res) => {
    const { standard, division, medium, subjectId, fromDate, toDate, studentId } = req.query;

    const activeYear = await AcademicYear.findOne({ isActive: true });
    if (!activeYear) {
      return sendResponse(res, 200, []);
    }

    let query = { academicYearId: activeYear._id };

    if (req.user.role === 'parent') {
      // A parent can only ever see their own child's class homework — every
      // filter is derived from the student, never from client-supplied values.
      const student = await verifyParentOwnsStudent(req, studentId);
      query.standard = student.standard;
      query.division = student.division;
      query.medium = student.medium;
    } else {
      // If teacher, strictly filter to their own assigned homework
      if (req.user.role === 'TEACHER') {
        query.teacherId = req.user._id;
      }

      if (standard) query.standard = standard;
      if (division) query.division = division;
      if (medium) query.medium = medium;
    }

    if (subjectId) query.subjectId = subjectId;

    if (fromDate || toDate) {
      query.dueDate = {};
      if (fromDate) query.dueDate.$gte = new Date(fromDate);
      if (toDate) query.dueDate.$lte = new Date(toDate);
    }

    const homeworks = await Homework.find(query)
      .populate('subjectId', 'subjectName subjectCode')
      .populate('teacherId', 'name')
      .sort({ dueDate: -1 });

    sendResponse(res, 200, homeworks);
  });

  /**
   * DELETE /api/v1/erp/homework/:id
   */
  static deleteHomework = catchAsync(async (req, res) => {
    const homework = await Homework.findById(req.params.id);
    if (!homework) {
      throw new AppError('Homework not found', 404);
    }

    // Guard: Only admin or the author can delete
    if (req.user.role !== 'ADMIN' && req.user._id.toString() !== homework.teacherId.toString()) {
      throw new AppError('You are not authorized to delete this homework', 403);
    }

    await homework.deleteOne();
    sendResponse(res, 200, null, 'Homework deleted successfully');
  });
}

export default HomeworkController;
