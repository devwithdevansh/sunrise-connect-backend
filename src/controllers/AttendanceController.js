import Attendance from '../models/Attendance.js';
import AcademicYear from '../models/AcademicYear.js';
import Student from '../models/Student.js';
import ClassTeacherAllocation from '../models/ClassTeacherAllocation.js';
import AllocationGuardService from '../services/AllocationGuardService.js';
import NotificationService from '../services/NotificationService.js';
import verifyParentOwnsStudent from '../utils/verifyParentOwnsStudent.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import sendResponse from '../utils/response.js';

const toDay = (d) => {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return day;
};

// Has the parent already been told about this record's current status?
// (Legacy sheets recorded this as an admin-verified ABSENT.)
const wasNotified = (rec) =>
  rec.notifiedAt || (rec.status === 'ABSENT' && rec.verifiedByAdmin && rec.verifiedAt) || null;

/**
 * Push an alert to the parent of every ABSENT/LATE student on the sheet who
 * has not been notified for their current status yet, then stamp them so a
 * later edit or re-confirm never double-notifies.
 */
async function notifyPendingParents(sheet, sentBy) {
  const dateStr = new Date(sheet.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  let notified = 0;
  for (const rec of sheet.records) {
    if (rec.status !== 'ABSENT' && rec.status !== 'LATE') continue;
    if (wasNotified(rec)) continue;
    const student = await Student.findById(rec.studentId).select('studentName parentId');
    if (student?.parentId) {
      const absent = rec.status === 'ABSENT';
      try {
        await NotificationService.sendBroadcast({
          sentBy,
          title: absent ? 'Attendance Alert' : 'Late Arrival',
          body: `${student.studentName} was marked ${absent ? 'absent' : 'late'} on ${dateStr}.`,
          targetType: 'STUDENT',
          targetFilter: { studentId: rec.studentId.toString() },
          type: 'ATTENDANCE_ABSENT',
        });
        notified += 1;
      } catch (err) {
        continue; // leave unstamped so a re-confirm retries this student
      }
    }
    rec.notifiedAt = new Date();
    rec.verifiedByAdmin = true;
    rec.verifiedAt = rec.verifiedAt || new Date();
    rec.verifiedBy = rec.verifiedBy || sentBy;
  }
  await sheet.save();
  return notified;
}

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
   * Teacher SUBMITS a sheet; Admin/Staff can edit it afterwards. Parents are
   * only notified when an admin confirms (see confirmSheet).
   */
  static saveAttendance = catchAsync(async (req, res) => {
    const { date, standard, division, medium, records } = req.body;

    if (!date || !standard || !division || !medium || !Array.isArray(records)) {
      return res.status(400).json({ status: 'fail', message: 'Missing required body parameters' });
    }

    const queryDate = toDay(date);
    const userId = req.user?._id || req.user?.id;
    const isTeacher = req.user.role === 'TEACHER';

    const activeYear = await AcademicYear.findOne({ isActive: true });
    if (!activeYear) {
      return res.status(400).json({ status: 'fail', message: 'No active academic year found' });
    }

    // Only the assigned class teacher (or admin/staff) may write a sheet.
    await AllocationGuardService.verifyClassTeacherAccess(
      req.user, activeYear._id, standard, division, medium
    );

    const existing = await Attendance.findOne({ date: queryDate, standard, division, medium });
    const existingConfirmed = !!existing && existing.status !== 'SUBMITTED';

    // A confirmed sheet is locked for teachers: parents have already seen it.
    if (isTeacher && existingConfirmed) {
      throw new AppError('This attendance was confirmed by the admin. Ask the admin to edit it.', 403);
    }

    // Keep notification bookkeeping for students whose status did not change.
    const preparedRecords = records.map((r) => {
      const prior = existing?.records?.find((p) => p.studentId.toString() === String(r.studentId));
      const same = !!prior && prior.status === r.status;
      const notifiedAt = same && wasNotified(prior) ? (prior.notifiedAt || prior.verifiedAt || new Date()) : null;
      return {
        studentId: r.studentId,
        status: r.status,
        remarks: r.remarks || null,
        notifiedAt,
        // ABSENT counts as "verified" only once the parent has been told.
        verifiedByAdmin: r.status !== 'ABSENT' || !!notifiedAt,
        verifiedAt: same ? prior.verifiedAt : null,
        verifiedBy: same ? prior.verifiedBy : null,
      };
    });

    const now = new Date();
    const $set = {
      academicYearId: activeYear._id,
      records: preparedRecords,
    };
    if (!existing) {
      $set.teacherId = userId;
      $set.status = 'SUBMITTED';
      $set.submittedAt = now;
    } else if (isTeacher) {
      $set.teacherId = userId;
      $set.submittedAt = now; // teacher re-submitting an unconfirmed sheet
    } else {
      // Admin/staff edit: never take over the teacher's authorship.
      $set.lastEditedBy = userId;
      $set.lastEditedAt = now;
    }

    const attendance = await Attendance.findOneAndUpdate(
      { date: queryDate, standard, division, medium },
      { $set },
      { new: true, upsert: true, runValidators: true }
    );

    // Edits after confirmation change what parents already saw, so tell the
    // parents of students who are newly absent/late.
    if (existingConfirmed) {
      await notifyPendingParents(attendance, userId);
    }

    sendResponse(res, 200, attendance);
  });

  /**
   * POST /api/v1/attendance/:id/confirm
   * Admin/staff confirms the whole sheet and pushes absent/late alerts.
   */
  static confirmSheet = catchAsync(async (req, res) => {
    const sheet = await Attendance.findById(req.params.id);
    if (!sheet) throw new AppError('Attendance sheet not found', 404);
    const userId = req.user?._id || req.user?.id;

    if (sheet.status !== 'CONFIRMED') {
      sheet.status = 'CONFIRMED';
      sheet.confirmedAt = new Date();
      sheet.confirmedBy = userId;
      await sheet.save();
    }
    const notified = await notifyPendingParents(sheet, userId);

    sendResponse(res, 200, { id: sheet._id, status: sheet.status, notified });
  });

  /**
   * GET /api/v1/attendance/overview?date=YYYY-MM-DD
   * One card per class: is the sheet filled, by whom, and its status.
   */
  static getOverview = catchAsync(async (req, res) => {
    const day = toDay(req.query.date || new Date());
    const activeYear = await AcademicYear.findOne({ isActive: true });

    const classes = await Student.aggregate([
      { $match: { isActive: { $ne: false }, isMigrated: true } },
      { $group: { _id: { standard: '$standard', division: '$division', medium: '$medium' }, studentCount: { $sum: 1 } } },
    ]);

    const [sheets, allocations] = await Promise.all([
      Attendance.find({ date: day }).lean(),
      activeYear
        ? ClassTeacherAllocation.find({ academicYearId: activeYear._id }).populate('teacherId', 'name contactNo1').lean()
        : [],
    ]);
    const key = (c) => `${c.standard}|${String(c.division).toUpperCase()}|${c.medium}`;
    const sheetMap = new Map(sheets.map((x) => [key(x), x]));
    const teacherMap = new Map(allocations.map((x) => [key(x), x.teacherId]));

    const cards = classes.map((c) => {
      const cls = { standard: c._id.standard, division: c._id.division, medium: c._id.medium };
      const sheet = sheetMap.get(key(cls));
      const count = (st) => (sheet ? sheet.records.filter((r) => r.status === st).length : 0);
      const teacher = teacherMap.get(key(cls));
      return {
        ...cls,
        studentCount: c.studentCount,
        classTeacher: teacher ? { id: teacher._id, name: teacher.name, mobile: teacher.contactNo1 || null } : null,
        status: !sheet ? 'NOT_SUBMITTED' : sheet.status === 'SUBMITTED' ? 'SUBMITTED' : 'CONFIRMED',
        attendanceId: sheet?._id || null,
        present: count('PRESENT'),
        absent: count('ABSENT'),
        late: count('LATE'),
        leave: count('LEAVE'),
        submittedAt: sheet?.submittedAt || sheet?.createdAt || null,
        confirmedAt: sheet?.confirmedAt || null,
        edited: !!sheet?.lastEditedAt,
      };
    });

    const n = (v) => (isNaN(Number(v)) ? 100 : Number(v));
    cards.sort((a, b) => n(a.standard) - n(b.standard) || String(a.division).localeCompare(b.division) || a.medium.localeCompare(b.medium));

    sendResponse(res, 200, cards);
  });

  /**
   * POST /api/v1/attendance/remind
   * Push a "please submit attendance" reminder to a class's teacher.
   */
  static remindTeacher = catchAsync(async (req, res) => {
    const { standard, division, medium, date } = req.body;
    if (!standard || !division || !medium) throw new AppError('standard, division and medium are required', 400);
    const activeYear = await AcademicYear.findOne({ isActive: true });
    if (!activeYear) throw new AppError('No active academic year found', 400);

    const allocation = await ClassTeacherAllocation.findOne({
      academicYearId: activeYear._id, standard, division: String(division).toUpperCase(), medium,
    });
    if (!allocation) throw new AppError('No class teacher is assigned to this class', 404);

    const result = await NotificationService.notifyUser({
      recipientRole: 'staff',
      recipientId: allocation.teacherId,
      title: 'Attendance pending',
      body: `Please submit today's attendance for Std ${standard}-${division} (${medium}).`,
      data: { type: 'ATTENDANCE_REMINDER', standard: String(standard), division: String(division), medium, date: date || '' },
    });
    sendResponse(res, 200, { delivered: result?.successCount || 0 });
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
      // Parents must never see a teacher's unconfirmed sheet.
      ...(req.user.role === 'parent' ? { status: { $ne: 'SUBMITTED' } } : {}),
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
