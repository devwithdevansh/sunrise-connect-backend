import Attendance from '../models/Attendance.js';
import AcademicYear from '../models/AcademicYear.js';
import Student from '../models/Student.js';
import AllocationGuardService from '../services/AllocationGuardService.js';
import NotificationService from '../services/NotificationService.js';
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

    // An absence needs admin sign-off before the parent is notified; every
    // other status is auto-verified. Re-saving a sheet must not un-verify (and
    // thus re-notify) an absence that was already reviewed.
    const existing = await Attendance.findOne({ date: queryDate, standard, division, medium });
    const preparedRecords = records.map((r) => {
      if (r.status !== 'ABSENT') {
        return { ...r, verifiedByAdmin: true, verifiedAt: null, verifiedBy: null };
      }
      const prior = existing?.records?.find((p) => p.studentId.toString() === r.studentId && p.status === 'ABSENT');
      if (prior?.verifiedByAdmin) {
        return { ...r, verifiedByAdmin: true, verifiedAt: prior.verifiedAt, verifiedBy: prior.verifiedBy };
      }
      return { ...r, verifiedByAdmin: false, verifiedAt: null, verifiedBy: null };
    });

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
          records: preparedRecords,
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
   * GET /api/v1/attendance/pending-absences
   * Admin/staff queue of absences awaiting verification before the parent is notified.
   */
  static getPendingAbsences = catchAsync(async (req, res) => {
    const sheets = await Attendance.find({
      records: { $elemMatch: { status: 'ABSENT', verifiedByAdmin: false } },
    })
      .sort({ date: -1 })
      .limit(200)
      .lean();

    const studentIds = [...new Set(
      sheets.flatMap((s) => s.records.filter((r) => r.status === 'ABSENT' && !r.verifiedByAdmin).map((r) => r.studentId.toString()))
    )];
    const studentDocs = await Student.find({ _id: { $in: studentIds } })
      .select('studentName standard division medium parentId')
      .populate('parentId', 'parentName primaryMobileNumber')
      .lean();
    const studentMap = new Map(studentDocs.map((s) => [s._id.toString(), s]));

    const pending = [];
    for (const sheet of sheets) {
      for (const rec of sheet.records) {
        if (rec.status === 'ABSENT' && !rec.verifiedByAdmin) {
          const student = studentMap.get(rec.studentId.toString());
          pending.push({
            attendanceId: sheet._id,
            date: sheet.date,
            studentId: rec.studentId,
            studentName: student?.studentName || 'Unknown',
            standard: sheet.standard,
            division: sheet.division,
            medium: sheet.medium,
            remarks: rec.remarks || null,
            parentMobile: student?.parentId?.primaryMobileNumber || null,
          });
        }
      }
    }

    sendResponse(res, 200, pending);
  });

  /**
   * POST /api/v1/attendance/:id/verify-absence
   * Admin confirms one student's absence, which triggers the parent notification.
   */
  static verifyAbsence = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { studentId } = req.body;
    if (!studentId) throw new AppError('studentId is required', 400);

    const sheet = await Attendance.findById(id);
    if (!sheet) throw new AppError('Attendance sheet not found', 404);

    const record = sheet.records.find((r) => r.studentId.toString() === studentId);
    if (!record) throw new AppError('No attendance record for this student on this sheet', 404);
    if (record.status !== 'ABSENT') throw new AppError('Only ABSENT records require verification', 400);

    if (!record.verifiedByAdmin) {
      record.verifiedByAdmin = true;
      record.verifiedAt = new Date();
      record.verifiedBy = req.user?._id || req.user?.id;
      await sheet.save();

      const student = await Student.findById(studentId).select('studentName parentId');
      if (student?.parentId) {
        const dateStr = new Date(sheet.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        await NotificationService.sendBroadcast({
          sentBy: req.user?._id || req.user?.id,
          title: 'Attendance Alert',
          body: `${student.studentName} was marked absent on ${dateStr}.`,
          targetType: 'STUDENT',
          targetFilter: { studentId },
          type: 'ATTENDANCE_ABSENT',
        });
      }
    }

    sendResponse(res, 200, { studentId, verifiedByAdmin: true });
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
