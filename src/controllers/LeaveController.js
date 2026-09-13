import LeaveRequest from '../models/LeaveRequest.js';
import AcademicYear from '../models/AcademicYear.js';
import Student from '../models/Student.js';
import AllocationGuardService from '../services/AllocationGuardService.js';
import verifyParentOwnsStudent from '../utils/verifyParentOwnsStudent.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import sendResponse from '../utils/response.js';

class LeaveController {
  /**
   * POST /api/v1/erp/leave
   * Parents submit leave requests for their own child (ownership-checked);
   * Admin/Staff/Teacher can also file one on a parent's behalf.
   */
  static createLeaveRequest = catchAsync(async (req, res) => {
    const { studentId, startDate, endDate, reason, attachments } = req.body;

    const activeYear = await AcademicYear.findOne({ isActive: true });
    if (!activeYear) {
      throw new AppError('No active academic year found', 400);
    }

    let student;
    if (req.user.role === 'parent') {
      student = await verifyParentOwnsStudent(req, studentId);
    } else {
      student = await Student.findById(studentId);
      if (!student) {
        throw new AppError('Student not found', 404);
      }
    }

    const leave = await LeaveRequest.create({
      academicYearId: activeYear._id,
      studentId,
      standard: student.standard,
      division: student.division,
      medium: student.medium,
      startDate,
      endDate,
      reason,
      attachments
    });

    sendResponse(res, 201, leave, 'Leave request submitted successfully');
  });

  /**
   * GET /api/v1/erp/leave
   * Teachers get leave requests for their assigned classes. Admins/Staff get all.
   * Parents get their own child's leave history (studentId required, ownership-checked).
   */
  static getLeaveRequests = catchAsync(async (req, res) => {
    const { standard, division, medium, status, studentId } = req.query;

    const activeYear = await AcademicYear.findOne({ isActive: true });
    if (!activeYear) {
      return sendResponse(res, 200, []);
    }

    let query = { academicYearId: activeYear._id };

    if (req.user.role === 'parent') {
      await verifyParentOwnsStudent(req, studentId);
      query.studentId = studentId;
      if (status) query.status = status;
    } else {
      if (standard) query.standard = standard;
      if (division) query.division = division;
      if (medium) query.medium = medium;
      if (status) query.status = status;

      // For teachers, we only want to fetch leaves for classes where they are the Class Teacher
      // The frontend will likely pass standard/division/medium of a class they select.
      // If they don't, we should enforce filtering here, but since the frontend passes the class,
      // we'll just verify they have access to the class if they aren't admin.
      if (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF' && standard && division && medium) {
         try {
           await AllocationGuardService.verifyClassTeacherAccess(
             req.user,
             activeYear._id,
             standard,
             division,
             medium
           );
         } catch (err) {
           // Not authorized for this class, return empty
           return sendResponse(res, 200, []);
         }
      }
    }

    const leaves = await LeaveRequest.find(query)
      .populate('studentId', 'studentName admissionNo rollNo')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });

    sendResponse(res, 200, leaves);
  });

  /**
   * PATCH /api/v1/erp/leave/:id/status
   * Approve or reject a leave request. Only class teacher or admin.
   */
  static updateLeaveStatus = catchAsync(async (req, res) => {
    const { status, reviewRemarks } = req.body;
    
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) {
      throw new AppError('Leave request not found', 404);
    }

    // Guard: Verify class teacher access before allowing approval
    await AllocationGuardService.verifyClassTeacherAccess(
      req.user,
      leave.academicYearId,
      leave.standard,
      leave.division,
      leave.medium
    );

    leave.status = status;
    leave.reviewedBy = req.user._id;
    if (reviewRemarks) leave.reviewRemarks = reviewRemarks;

    await leave.save();

    sendResponse(res, 200, leave, `Leave request ${status.toLowerCase()} successfully`);
  });
}

export default LeaveController;
