import Attendance from '../models/Attendance.js';
import AcademicYear from '../models/AcademicYear.js';
import Student from '../models/Student.js';
import AllocationGuardService from '../services/AllocationGuardService.js';
import verifyParentOwnsStudent from '../utils/verifyParentOwnsStudent.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import sendResponse from '../utils/response.js';

class AttendanceController {
  /**
   * GET /api/v1/attendance
   * Fetch attendance for a specific class and date
   */
  static getAttendance = catchAsync(async (req, res) => {
    const { date, standard, division, medium } = req.query;

    if (!date || !standard || !division || !medium) {
      return res.status(400).json({ status: 'fail', message: 'Missing required query parameters' });
    }

    // Convert date string to a start-of-day Date object for querying
    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      date: queryDate,
      standard,
      division,
      medium,
    });

    sendResponse(res, 200, attendance);
  });

  /**
   * POST /api/v1/attendance
   * Create or update attendance for a specific class and date
   */
  static saveAttendance = catchAsync(async (req, res) => {
    const { date, standard, division, medium, records } = req.body;
    
    if (!date || !standard || !division || !medium || !records) {
      return res.status(400).json({ status: 'fail', message: 'Missing required body parameters' });
    }

    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);

    // Get active academic year
    const activeYear = await AcademicYear.findOne({ isActive: true });
    if (!activeYear) {
      return res.status(400).json({ status: 'fail', message: 'No active academic year found' });
    }

    // Verify allocation access
    await AllocationGuardService.verifyClassTeacherAccess(
      req.user,
      activeYear._id,
      standard,
      division,
      medium
    );

    // Upsert the attendance record
    const attendance = await Attendance.findOneAndUpdate(
      {
        date: queryDate,
        standard,
        division,
        medium,
      },
      {
        $set: {
          teacherId: req.user?._id || req.user?.id,
          academicYearId: activeYear._id,
          records,
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    sendResponse(res, 200, attendance);
  });

  /**
   * GET /api/v1/attendance/student/:studentId?month=&year=
   * A parent's view of one child's attendance for a given month
   * (defaults to the current month). Ownership-checked for parents.
   */
  static getAttendanceForStudent = catchAsync(async (req, res) => {
    const { studentId } = req.params;
    const { month, year } = req.query;

    let student;
    if (req.user.role === 'parent') {
      student = await verifyParentOwnsStudent(req, studentId);
    } else {
      student = await Student.findById(studentId);
      if (!student) throw new AppError('Student not found', 404);
    }

    const now = new Date();
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1; // 1-12
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1); // first day of next month, exclusive

    const days = await Attendance.find({
      standard: student.standard,
      division: student.division,
      medium: student.medium,
      date: { $gte: start, $lt: end },
    }).sort({ date: 1 });

    const records = days
      .map((day) => {
        const rec = day.records.find((r) => r.studentId.toString() === studentId);
        return rec ? { date: day.date, status: rec.status, remarks: rec.remarks } : null;
      })
      .filter(Boolean);

    sendResponse(res, 200, records);
  });
}

export default AttendanceController;
